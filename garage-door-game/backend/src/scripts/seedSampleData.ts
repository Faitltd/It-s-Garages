import { db } from '../config/database';
import { googleApiService } from '../services/googleApiService';

interface SampleEntry {
  address: string;
  garage_door_count: number;
  garage_door_width: number;
  garage_door_height: number;
  garage_door_type: string;
  garage_door_material: string;
  confidence_level: number;
  notes?: string;
}

// Sample RESIDENTIAL garage door data for testing
const sampleData: SampleEntry[] = [
  {
    address: "123 Oak Street, Palo Alto, CA 94301",
    garage_door_count: 2,
    garage_door_width: 8,
    garage_door_height: 7,
    garage_door_type: "double",
    garage_door_material: "steel",
    confidence_level: 5,
    notes: "Standard residential double garage door"
  },
  {
    address: "456 Maple Avenue, Cupertino, CA 95014",
    garage_door_count: 1,
    garage_door_width: 9,
    garage_door_height: 8,
    garage_door_type: "single",
    garage_door_material: "aluminum",
    confidence_level: 4,
    notes: "Modern single door with glass panels"
  },
  {
    address: "789 Pine Drive, Mountain View, CA 94043",
    garage_door_count: 2,
    garage_door_width: 8,
    garage_door_height: 7,
    garage_door_type: "double",
    garage_door_material: "wood",
    confidence_level: 4,
    notes: "Traditional wooden double garage"
  },
  {
    address: "321 Elm Street, Menlo Park, CA 94025",
    garage_door_count: 2,
    garage_door_width: 9,
    garage_door_height: 8,
    garage_door_type: "double",
    garage_door_material: "composite",
    confidence_level: 5,
    notes: "High-end composite material doors"
  },
  {
    address: "654 Cedar Lane, Redwood City, CA 94061",
    garage_door_count: 1,
    garage_door_width: 8,
    garage_door_height: 7,
    garage_door_type: "single",
    garage_door_material: "steel",
    confidence_level: 3,
    notes: "Standard single steel door"
  }
];

async function seedSampleData() {
  console.log('🌱 Seeding sample garage door data...');
  
  try {
    // First, create a sample user if it doesn't exist
    const userId = await createSampleUser();
    
    for (const entry of sampleData) {
      console.log(`Processing: ${entry.address}`);
      
      try {
        // Get coordinates for the address
        const coordinates = await googleApiService.geocodeAddress(entry.address);
        let lat = 0, lng = 0, streetViewUrl = '';
        
        if (coordinates) {
          lat = coordinates.lat;
          lng = coordinates.lng;
          
          // Generate Street View URL
          streetViewUrl = googleApiService.buildStreetViewUrl({
            lat,
            lng,
            size: '640x640',
            heading: 0,
            pitch: -10,
            fov: 90
          });
        }
        
        // Calculate door size string
        const doorSize = `${entry.garage_door_width}x${entry.garage_door_height} feet`;
        
        // Insert the data entry
        const entryId = await insertDataEntry({
          ...entry,
          userId,
          lat,
          lng,
          streetViewUrl,
          doorSize
        });
        
        // Mark as verified (since this is sample data)
        await verifyDataEntry(entryId, userId);
        
        console.log(`✅ Added entry ${entryId}: ${entry.address}`);
        
        // Small delay to avoid hitting API limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to process ${entry.address}:`, error);
      }
    }
    
    console.log('🎉 Sample data seeding completed!');
    
  } catch (error) {
    console.error('💥 Error seeding sample data:', error);
  }
}

async function createSampleUser(): Promise<number> {
  return new Promise((resolve, reject) => {
    // Check if sample user exists
    db.get('SELECT id FROM users WHERE username = ?', ['sample_user'], (err, row: any) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (row) {
        resolve(row.id);
        return;
      }
      
      // Create sample user
      const stmt = db.prepare(`
        INSERT INTO users (username, email, password_hash, total_points, games_played, accuracy_rate)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        'sample_user',
        'sample@example.com',
        'hashed_password', // In real app, this would be properly hashed
        100,
        5,
        0.85
      ], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
      
      stmt.finalize();
    });
  });
}

async function insertDataEntry(data: any): Promise<number> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO garage_door_data_entries (
        user_id, address, garage_door_count, garage_door_width, garage_door_height,
        garage_door_type, garage_door_material, door_size, notes, confidence_level,
        street_view_url, latitude, longitude, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run([
      data.userId,
      data.address,
      data.garage_door_count,
      data.garage_door_width,
      data.garage_door_height,
      data.garage_door_type,
      data.garage_door_material,
      data.doorSize,
      data.notes || null,
      data.confidence_level,
      data.streetViewUrl || null,
      data.lat || null,
      data.lng || null
    ], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.lastID);
    });
    
    stmt.finalize();
  });
}

async function verifyDataEntry(entryId: number, verifierId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      UPDATE garage_door_data_entries 
      SET is_verified = 1, verified_by_user_id = ?, verified_at = CURRENT_TIMESTAMP,
          verification_notes = 'Sample verified data'
      WHERE id = ?
    `);
    
    stmt.run([verifierId, entryId], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
    
    stmt.finalize();
  });
}

// CLI execution
if (require.main === module) {
  seedSampleData()
    .then(() => {
      console.log('✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export { seedSampleData };
