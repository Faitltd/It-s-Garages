import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DATABASE_PATH = process.env.DATABASE_PATH || './database/garage_game.db';

// Ensure database directory exists
const dbDir = path.dirname(DATABASE_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Enable verbose mode in development
const sqlite = process.env.NODE_ENV === 'development' ? sqlite3.verbose() : sqlite3;

export const db = new sqlite.Database(DATABASE_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Database schema initialization
export const initializeDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          total_points INTEGER DEFAULT 0,
          games_played INTEGER DEFAULT 0,
          jobs_submitted INTEGER DEFAULT 0,
          accuracy_rate REAL DEFAULT 0.0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT 1,
          role VARCHAR(20) DEFAULT 'user'
        )
      `);

      // Jobs table (user-submitted garage door data)
      db.run(`
        CREATE TABLE IF NOT EXISTS jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          address TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          garage_door_count INTEGER NOT NULL,
          garage_door_width REAL,
          garage_door_height REAL,
          garage_type VARCHAR(50),
          notes TEXT,
          photo_filename VARCHAR(255),
          status VARCHAR(20) DEFAULT 'pending',
          points_awarded INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          verified_at DATETIME,
          verified_by INTEGER,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (verified_by) REFERENCES users (id)
        )
      `);

      // Game sessions table
      db.run(`
        CREATE TABLE IF NOT EXISTS game_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          job_id INTEGER NOT NULL,
          guess_door_count INTEGER,
          guess_door_width REAL,
          guess_door_height REAL,
          guess_garage_type VARCHAR(50),
          is_correct BOOLEAN DEFAULT 0,
          points_earned INTEGER DEFAULT 0,
          time_taken INTEGER,
          difficulty VARCHAR(20) DEFAULT 'medium',
          location_lat REAL,
          location_lng REAL,
          location_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (job_id) REFERENCES jobs (id)
        )
      `);

      // Leaderboard view (virtual table)
      db.run(`
        CREATE VIEW IF NOT EXISTS leaderboard AS
        SELECT 
          u.id,
          u.username,
          u.total_points,
          u.games_played,
          u.jobs_submitted,
          u.accuracy_rate,
          RANK() OVER (ORDER BY u.total_points DESC) as rank
        FROM users u
        WHERE u.is_active = 1
        ORDER BY u.total_points DESC
      `);

      // Indexes for performance
      db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_game_sessions_job_id ON game_sessions(job_id)`);

      // Triggers for updating timestamps
      db.run(`
        CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
        AFTER UPDATE ON users
        BEGIN
          UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
      `);

      console.log('Database schema initialized successfully');
      resolve();
    });

    db.on('error', (err) => {
      console.error('Database error:', err);
      reject(err);
    });
  });
};

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

export default db;
