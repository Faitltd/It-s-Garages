import { db } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

interface CentennialAddress {
  name: string;
  description: string;
  lat: number;
  lng: number;
  address?: string;
  hasGarageDoor?: boolean;
  garageDoorCount?: number | undefined;
  garageDoorWidth?: number | undefined;
  garageDoorHeight?: number | undefined;
}

/**
 * Create the centennial_addresses table
 */
function createCentennialAddressesTable(): Promise<void> {
  return new Promise((resolve, reject) => {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS centennial_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        address TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        has_garage_door BOOLEAN DEFAULT 0,
        garage_door_count INTEGER,
        garage_door_width REAL,
        garage_door_height REAL,
        image_url TEXT,
        street_view_url TEXT,
        is_processed BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    db.run(createTableSQL, (err) => {
      if (err) {
        console.error('Error creating centennial_addresses table:', err);
        reject(err);
      } else {
        console.log('✅ Created centennial_addresses table');
        resolve();
      }
    });
  });
}

/**
 * Parse description field to extract address and garage door info
 */
function parseDescription(description: string): {
  address?: string;
  hasGarageDoor?: boolean;
  garageDoorCount?: number;
  garageDoorWidth?: number;
  garageDoorHeight?: number;
  imageUrl?: string;
} {
  const result: any = {};

  // Extract address
  const addressMatch = description.match(/ADDRESS:\s*([^<]+)/);
  if (addressMatch && addressMatch[1]) {
    result.address = addressMatch[1].trim();
  }

  // Extract garage door count
  const numGdoorMatch = description.match(/NUM_GDOOR:\s*(\d+)/);
  if (numGdoorMatch && numGdoorMatch[1]) {
    result.garageDoorCount = parseInt(numGdoorMatch[1]);
    result.hasGarageDoor = true;
  }

  // Extract garage door dimensions from description patterns like "7X8; 16X8"
  const dimensionMatch = description.match(/(\d+)X(\d+)/);
  if (dimensionMatch && dimensionMatch[1] && dimensionMatch[2]) {
    result.garageDoorWidth = parseInt(dimensionMatch[1]);
    result.garageDoorHeight = parseInt(dimensionMatch[2]);
    result.hasGarageDoor = true;
  }

  // Extract width and height from specific fields
  const widthMatch = description.match(/WIDTH_GDOOR:\s*(\d+)/);
  if (widthMatch && widthMatch[1]) {
    result.garageDoorWidth = parseInt(widthMatch[1]);
  }

  const heightMatch = description.match(/HEIGHT_GDOOR:\s*(\d+)/);
  if (heightMatch && heightMatch[1]) {
    result.garageDoorHeight = parseInt(heightMatch[1]);
  }

  // Extract image URL
  const imageUrlMatch = description.match(/IMAGE_URL:\s*([^<\s]+)/);
  if (imageUrlMatch && imageUrlMatch[1] && imageUrlMatch[1] !== '') {
    result.imageUrl = imageUrlMatch[1].trim();
  }

  // Check for garage door indicators
  if (description.includes('1D2C') || description.includes('2D1C') || 
      description.includes('2D2C') || description.includes('1D1C') ||
      description.includes('2C1D') || description.includes('2C2D')) {
    result.hasGarageDoor = true;
  }

  return result;
}

/**
 * Import addresses from CSV file
 */
async function importCentennialAddresses(): Promise<void> {
  const csvFilePath = path.join(__dirname, '../../../../centennial_points.csv');
  
  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`CSV file not found: ${csvFilePath}`);
  }

  console.log('📂 Reading CSV file:', csvFilePath);

  return new Promise((resolve, reject) => {
    const addresses: CentennialAddress[] = [];
    let processedCount = 0;
    let validAddressCount = 0;

    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row: any) => {
        processedCount++;
        
        // Parse the row data
        const name = row.name || '';
        const description = row.description || '';
        const lat = parseFloat(row.lat);
        const lng = parseFloat(row.lng);

        // Skip invalid coordinates
        if (isNaN(lat) || isNaN(lng)) {
          return;
        }

        // Parse description for additional data
        const parsed = parseDescription(description);
        
        // Only include addresses with actual street addresses
        if (parsed.address && parsed.address.length > 5) {
          validAddressCount++;
          
          const address: CentennialAddress = {
            name: name,
            description: description,
            lat: lat,
            lng: lng,
            address: parsed.address,
            hasGarageDoor: parsed.hasGarageDoor || false,
            garageDoorCount: parsed.garageDoorCount,
            garageDoorWidth: parsed.garageDoorWidth,
            garageDoorHeight: parsed.garageDoorHeight
          };

          addresses.push(address);
        }

        // Log progress every 1000 rows
        if (processedCount % 1000 === 0) {
          console.log(`📊 Processed ${processedCount} rows, found ${validAddressCount} valid addresses`);
        }
      })
      .on('end', async () => {
        console.log(`✅ Finished reading CSV: ${processedCount} total rows, ${validAddressCount} valid addresses`);
        
        // Insert addresses into database
        await insertAddresses(addresses);
        resolve();
      })
      .on('error', (error: any) => {
        console.error('❌ Error reading CSV:', error);
        reject(error);
      });
  });
}

/**
 * Insert addresses into database
 */
async function insertAddresses(addresses: CentennialAddress[]): Promise<void> {
  console.log(`💾 Inserting ${addresses.length} addresses into database...`);

  const insertSQL = `
    INSERT INTO centennial_addresses (
      name, description, address, latitude, longitude, 
      has_garage_door, garage_door_count, garage_door_width, garage_door_height
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  return new Promise((resolve, reject) => {
    const stmt = db.prepare(insertSQL);
    let insertedCount = 0;
    let errorCount = 0;

    // Insert addresses in batches
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      addresses.forEach((address) => {
        stmt.run([
          address.name,
          address.description,
          address.address,
          address.lat,
          address.lng,
          address.hasGarageDoor ? 1 : 0,
          address.garageDoorCount || null,
          address.garageDoorWidth || null,
          address.garageDoorHeight || null
        ], (err) => {
          if (err) {
            errorCount++;
            console.error('Error inserting address:', err);
          } else {
            insertedCount++;
          }
        });
      });

      db.run('COMMIT', (err) => {
        stmt.finalize();
        
        if (err) {
          console.error('❌ Error committing transaction:', err);
          reject(err);
        } else {
          console.log(`✅ Successfully inserted ${insertedCount} addresses`);
          if (errorCount > 0) {
            console.log(`⚠️  ${errorCount} addresses failed to insert`);
          }
          resolve();
        }
      });
    });
  });
}

/**
 * Main import function
 */
export async function importCentennialData(): Promise<void> {
  try {
    console.log('🚀 Starting Centennial addresses import...');
    
    // Create table
    await createCentennialAddressesTable();
    
    // Import addresses
    await importCentennialAddresses();
    
    console.log('🎉 Centennial addresses import completed successfully!');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  }
}

// Run import if this file is executed directly
if (require.main === module) {
  importCentennialData()
    .then(() => {
      console.log('Import completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Import failed:', error);
      process.exit(1);
    });
}
