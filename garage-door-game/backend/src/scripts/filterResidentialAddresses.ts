#!/usr/bin/env node

/**
 * Batch script to filter Centennial addresses for residential properties
 * This script will check all addresses in the database and mark them as residential or not
 */

import { db } from '../config/database';
import { batchCheckResidential } from '../services/overpassFilter';

interface CentennialAddress {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  is_residential?: boolean;
}

/**
 * Get all Centennial addresses that haven't been checked for residential status
 */
function getUnfilteredAddresses(): Promise<CentennialAddress[]> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      SELECT id, name, address, latitude, longitude
      FROM centennial_addresses 
      WHERE address IS NOT NULL 
        AND address != ''
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
        AND is_residential IS NULL
      ORDER BY id
    `);

    stmt.all([], (err, rows) => {
      if (err) {
        console.error('Error getting unfiltered addresses:', err);
        reject(err);
      } else {
        resolve(rows as CentennialAddress[]);
      }
    });
  });
}

/**
 * Update address with residential status
 */
function updateResidentialStatus(id: number, isResidential: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      UPDATE centennial_addresses 
      SET is_residential = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run([isResidential ? 1 : 0, id], (err) => {
      if (err) {
        console.error('Error updating residential status:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Add is_residential column if it doesn't exist
 */
function addResidentialColumn(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(`
      ALTER TABLE centennial_addresses 
      ADD COLUMN is_residential INTEGER DEFAULT NULL
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding residential column:', err);
        reject(err);
      } else {
        console.log('Residential column added or already exists');
        resolve();
      }
    });
  });
}

/**
 * Main function to process all addresses
 */
async function main() {
  try {
    console.log('🏠 Starting residential address filtering...');
    
    // Add residential column if needed
    await addResidentialColumn();
    
    // Get all unfiltered addresses
    const addresses = await getUnfilteredAddresses();
    console.log(`Found ${addresses.length} addresses to check`);
    
    if (addresses.length === 0) {
      console.log('✅ All addresses have already been filtered');
      process.exit(0);
    }
    
    // Process in batches of 50 to avoid overwhelming the API
    const batchSize = 50;
    let processed = 0;
    let residential = 0;
    let nonResidential = 0;
    
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      console.log(`\n📍 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(addresses.length / batchSize)} (${batch.length} addresses)`);
      
      // Check residential status for this batch
      const results = await batchCheckResidential(
        batch.map(addr => ({
          lat: addr.latitude,
          lng: addr.longitude,
          id: addr.id.toString()
        }))
      );
      
      // Update database with results
      for (const result of results) {
        const addressId = parseInt(result.id!);
        const address = batch.find(a => a.id === addressId);
        
        await updateResidentialStatus(addressId, result.isResidential);
        
        if (result.isResidential) {
          residential++;
          console.log(`✅ ${address?.address} - RESIDENTIAL`);
        } else {
          nonResidential++;
          console.log(`❌ ${address?.address} - NOT RESIDENTIAL`);
        }
        
        processed++;
      }
      
      console.log(`Progress: ${processed}/${addresses.length} (${Math.round(processed / addresses.length * 100)}%)`);
      
      // Small delay between batches to be respectful to the API
      if (i + batchSize < addresses.length) {
        console.log('⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('\n🎉 Filtering complete!');
    console.log(`📊 Results:`);
    console.log(`   Total processed: ${processed}`);
    console.log(`   Residential: ${residential} (${Math.round(residential / processed * 100)}%)`);
    console.log(`   Non-residential: ${nonResidential} (${Math.round(nonResidential / processed * 100)}%)`);
    
    // Show some statistics
    console.log('\n📈 Updated database statistics:');
    const stats = await getResidentialStats();
    console.log(`   Total addresses: ${stats.total}`);
    console.log(`   Residential: ${stats.residential} (${Math.round(stats.residential / stats.total * 100)}%)`);
    console.log(`   Non-residential: ${stats.nonResidential} (${Math.round(stats.nonResidential / stats.total * 100)}%)`);
    console.log(`   Unfiltered: ${stats.unfiltered} (${Math.round(stats.unfiltered / stats.total * 100)}%)`);
    
  } catch (error) {
    console.error('❌ Error during filtering:', error);
    process.exit(1);
  }
}

/**
 * Get residential filtering statistics
 */
function getResidentialStats(): Promise<{total: number, residential: number, nonResidential: number, unfiltered: number}> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_residential = 1 THEN 1 ELSE 0 END) as residential,
        SUM(CASE WHEN is_residential = 0 THEN 1 ELSE 0 END) as nonResidential,
        SUM(CASE WHEN is_residential IS NULL THEN 1 ELSE 0 END) as unfiltered
      FROM centennial_addresses
      WHERE address IS NOT NULL AND address != ''
    `);

    stmt.get([], (err, row: any) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          total: row.total || 0,
          residential: row.residential || 0,
          nonResidential: row.nonResidential || 0,
          unfiltered: row.unfiltered || 0
        });
      }
    });
  });
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { main as filterResidentialAddresses };
