#!/usr/bin/env node

/**
 * Migration script to add is_residential column to centennial_addresses table
 */

import { db } from '../config/database';

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
        console.log('✅ Residential column added or already exists');
        resolve();
      }
    });
  });
}

/**
 * Check if centennial_addresses table exists
 */
function checkTableExists(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='centennial_addresses'
    `, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(!!row);
      }
    });
  });
}

/**
 * Create centennial_addresses table if it doesn't exist
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
        garage_not_visible BOOLEAN DEFAULT 0,
        is_residential INTEGER DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    db.run(createTableSQL, (err) => {
      if (err) {
        console.error('Error creating centennial_addresses table:', err);
        reject(err);
      } else {
        console.log('✅ Centennial addresses table created or already exists');
        resolve();
      }
    });
  });
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🔧 Checking centennial_addresses table...');
    
    const tableExists = await checkTableExists();
    
    if (!tableExists) {
      console.log('📋 Creating centennial_addresses table...');
      await createCentennialAddressesTable();
    } else {
      console.log('📋 Table exists, adding residential column...');
      await addResidentialColumn();
    }
    
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
main();
