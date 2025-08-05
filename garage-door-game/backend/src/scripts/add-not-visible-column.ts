import { db } from '../config/database';

/**
 * Add garage_not_visible column to centennial_addresses table
 */
export function addNotVisibleColumn(): Promise<void> {
  return new Promise((resolve, reject) => {
    const alterTableSQL = `
      ALTER TABLE centennial_addresses 
      ADD COLUMN garage_not_visible BOOLEAN DEFAULT 0
    `;

    db.run(alterTableSQL, (err) => {
      if (err) {
        // Check if column already exists
        if (err.message.includes('duplicate column name')) {
          console.log('✅ garage_not_visible column already exists');
          resolve();
        } else {
          console.error('Error adding garage_not_visible column:', err);
          reject(err);
        }
      } else {
        console.log('✅ Added garage_not_visible column to centennial_addresses table');
        resolve();
      }
    });
  });
}

// Run migration if this file is executed directly
if (require.main === module) {
  addNotVisibleColumn()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
