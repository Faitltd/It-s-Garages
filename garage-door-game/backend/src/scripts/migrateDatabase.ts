import { db } from '../config/database';

/**
 * Add missing columns to game_sessions table
 */
const migrateGameSessions = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Check if columns exist and add them if they don't
      db.all("PRAGMA table_info(game_sessions)", (err, columns: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const columnNames = columns.map(col => col.name);
        const migrations = [];

        if (!columnNames.includes('difficulty')) {
          migrations.push("ALTER TABLE game_sessions ADD COLUMN difficulty VARCHAR(20) DEFAULT 'medium'");
        }

        if (!columnNames.includes('location_lat')) {
          migrations.push("ALTER TABLE game_sessions ADD COLUMN location_lat REAL");
        }

        if (!columnNames.includes('location_lng')) {
          migrations.push("ALTER TABLE game_sessions ADD COLUMN location_lng REAL");
        }

        if (!columnNames.includes('location_address')) {
          migrations.push("ALTER TABLE game_sessions ADD COLUMN location_address TEXT");
        }

        // Execute migrations
        let completed = 0;
        if (migrations.length === 0) {
          console.log('No migrations needed for game_sessions table');
          resolve();
          return;
        }

        migrations.forEach((migration, index) => {
          db.run(migration, (err) => {
            if (err) {
              console.error(`Migration failed: ${migration}`, err);
              reject(err);
              return;
            }
            
            console.log(`Migration completed: ${migration}`);
            completed++;
            
            if (completed === migrations.length) {
              console.log('All game_sessions migrations completed successfully');
              resolve();
            }
          });
        });
      });
    });
  });
};

/**
 * Run all database migrations
 */
export const runMigrations = async (): Promise<void> => {
  try {
    console.log('Starting database migrations...');
    await migrateGameSessions();
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migrations completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}
