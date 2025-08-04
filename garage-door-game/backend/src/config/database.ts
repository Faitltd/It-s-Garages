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
          validation_games_played INTEGER DEFAULT 0,
          validation_accuracy_rate REAL DEFAULT 0.0,
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

      // Data submissions table - Updated to make material, color, style optional
      db.run(`
        CREATE TABLE IF NOT EXISTS data_submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          address TEXT NOT NULL,
          garage_door_size TEXT NOT NULL,
          material TEXT,
          color TEXT,
          style TEXT,
          notes TEXT,
          photo_path TEXT,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);

      // Score logs table
      db.run(`
        CREATE TABLE IF NOT EXISTS score_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          points_awarded INTEGER NOT NULL,
          reason TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
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

      // Add data_submissions column to users table if it doesn't exist
      db.run(`ALTER TABLE users ADD COLUMN data_submissions INTEGER DEFAULT 0`, (err) => {
        // Ignore error if column already exists
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding data_submissions column:', err);
        }
      });

      // Migration: Create a new simplified data submissions table
      db.run(`
        CREATE TABLE IF NOT EXISTS simple_data_submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          address TEXT NOT NULL,
          garage_door_size TEXT NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);

      // ============================================================================
      // CORE GARAGE DOOR DATA STRUCTURE - PRODUCTION FOUNDATION
      // This is the structured foundation to connect addresses to predicted door sizes
      // ============================================================================

      // Garage Door Properties Table - Core data structure for address-to-door-size mapping
      db.run(`
        CREATE TABLE IF NOT EXISTS garage_door_properties (
          id INTEGER PRIMARY KEY AUTOINCREMENT,

          -- Address Information
          address TEXT NOT NULL UNIQUE,    -- Full address (string)
          lat REAL NOT NULL,              -- GPS latitude
          lng REAL NOT NULL,              -- GPS longitude

          -- Garage Door Specifications
          garage_type TEXT NOT NULL,           -- single, double, RV, golf-cart add-on, etc.
          garage_door_size TEXT NOT NULL,      -- e.g., 8×7 ft, 16×7 ft, 18×8 ft
          door_width_ft REAL,                  -- Width in feet (extracted from size)
          door_height_ft REAL,                 -- Height in feet (extracted from size)

          -- Prediction Confidence & Source
          confidence REAL DEFAULT 0.0,         -- Numeric score (0–1) when prediction is auto-generated
          source TEXT NOT NULL,                -- human_verified | builder_spec | ai_prediction | game_submission

          -- Visual Data
          photo_url TEXT,                      -- Link to Street View image used
          street_view_heading INTEGER,         -- Camera heading when photo was taken
          street_view_pitch INTEGER,           -- Camera pitch when photo was taken

          -- Verification & Timestamps
          last_verified DATETIME,              -- When this data was last verified
          verified_by_user_id INTEGER,         -- User who verified this data
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

          -- Additional Metadata
          notes TEXT,                          -- Additional notes about the property
          building_style TEXT,                 -- Ranch, Colonial, Modern, etc.
          driveway_type TEXT,                  -- Straight, Curved, Circular, etc.

          FOREIGN KEY (verified_by_user_id) REFERENCES users (id)
        )
      `);

      // Garage Door Detection Results - Computer Vision Model Outputs
      db.run(`
        CREATE TABLE IF NOT EXISTS cv_detection_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          property_id INTEGER NOT NULL,

          -- Detection Metadata
          model_version TEXT NOT NULL,         -- Version of CV model used
          detection_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

          -- Bounding Box Coordinates (normalized 0-1)
          bbox_x1 REAL,                       -- Top-left x
          bbox_y1 REAL,                       -- Top-left y
          bbox_x2 REAL,                       -- Bottom-right x
          bbox_y2 REAL,                       -- Bottom-right y

          -- Detection Results
          detected_type TEXT,                  -- single, double, RV, etc.
          detected_size TEXT,                  -- Predicted size (8×7 ft, etc.)
          confidence_score REAL,              -- Model confidence (0-1)

          -- Raw Model Outputs
          raw_predictions TEXT,               -- JSON of all model predictions
          processing_time_ms INTEGER,         -- Time taken for inference

          FOREIGN KEY (property_id) REFERENCES garage_door_properties (id)
        )
      `);

      // Price Estimates Table - Cost calculations based on door specifications
      db.run(`
        CREATE TABLE IF NOT EXISTS price_estimates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          property_id INTEGER NOT NULL,

          -- Estimate Details
          door_size TEXT NOT NULL,
          door_type TEXT NOT NULL,
          material_type TEXT DEFAULT 'standard', -- standard, premium, custom

          -- Cost Breakdown
          material_cost REAL NOT NULL,
          labor_cost REAL NOT NULL,
          total_estimate REAL NOT NULL,
          margin_percentage REAL DEFAULT 0.20,   -- Configurable margin

          -- Estimate Metadata
          estimate_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          valid_until DATETIME,                   -- Estimate expiration
          created_by TEXT DEFAULT 'system',      -- system | user | admin

          -- Additional Costs
          removal_cost REAL DEFAULT 0,           -- Old door removal
          installation_complexity_multiplier REAL DEFAULT 1.0,

          FOREIGN KEY (property_id) REFERENCES garage_door_properties (id)
        )
      `);

      // Tract Development Data - Known developments with uniform door sizes
      db.run(`
        CREATE TABLE IF NOT EXISTS tract_developments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,

          -- Development Information
          development_name TEXT NOT NULL,
          builder_name TEXT,
          year_built_start INTEGER,
          year_built_end INTEGER,

          -- Geographic Boundaries
          boundary_polygon TEXT,              -- GeoJSON polygon of development area
          center_lat REAL,
          center_lng REAL,

          -- Standard Specifications
          standard_garage_type TEXT,          -- Most common garage type in development
          standard_door_size TEXT,            -- Most common door size
          confidence REAL DEFAULT 0.9,       -- High confidence for tract homes

          -- Metadata
          source TEXT,                        -- builder_docs | hoa_records | survey
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Indexes for performance
      db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_game_sessions_job_id ON game_sessions(job_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_data_submissions_user_id ON data_submissions(user_id)`);

      // New indexes for garage door data
      db.run(`CREATE INDEX IF NOT EXISTS idx_garage_door_properties_address ON garage_door_properties(address)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_garage_door_properties_lat_lng ON garage_door_properties(lat, lng)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_garage_door_properties_source ON garage_door_properties(source)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_cv_detection_results_property_id ON cv_detection_results(property_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_price_estimates_property_id ON price_estimates(property_id)`);

      // Triggers for updating timestamps
      db.run(`
        CREATE TRIGGER IF NOT EXISTS update_users_timestamp
        AFTER UPDATE ON users
        BEGIN
          UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
      `);

      // Game Questions Table - Multiple choice questions generated from job data
      db.run(`
        CREATE TABLE IF NOT EXISTS game_questions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          address TEXT NOT NULL,
          image_url TEXT NOT NULL,
          correct_answer TEXT NOT NULL,
          option_a TEXT NOT NULL,
          option_b TEXT NOT NULL,
          option_c TEXT NOT NULL,
          option_d TEXT NOT NULL,
          difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
          points_value INTEGER DEFAULT 20,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT 1
        )
      `);

      // Question Game Results - Track user performance on questions
      db.run(`
        CREATE TABLE IF NOT EXISTS question_game_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          question_id INTEGER NOT NULL,
          selected_answer TEXT NOT NULL,
          correct_answer TEXT NOT NULL,
          is_correct BOOLEAN NOT NULL,
          points_earned INTEGER DEFAULT 0,
          time_taken REAL,
          difficulty TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (question_id) REFERENCES game_questions (id)
        )
      `);

      // User Achievements Table - Track milestones and badges
      db.run(`
        CREATE TABLE IF NOT EXISTS user_achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          achievement_type TEXT NOT NULL, -- 'streak', 'accuracy', 'points', 'games_played'
          achievement_name TEXT NOT NULL,
          description TEXT,
          points_awarded INTEGER DEFAULT 0,
          earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,

          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);

      // Leaderboard View - Virtual table for rankings
      db.run(`
        CREATE VIEW IF NOT EXISTS leaderboard AS
        SELECT
          u.id,
          u.username,
          u.total_points,
          u.games_played,
          u.accuracy_rate,
          RANK() OVER (ORDER BY u.total_points DESC) as rank,
          COUNT(qgr.id) as questions_answered,
          AVG(CASE WHEN qgr.is_correct THEN 1.0 ELSE 0.0 END) as question_accuracy
        FROM users u
        LEFT JOIN question_game_results qgr ON u.id = qgr.user_id
        WHERE u.total_points > 0
        GROUP BY u.id, u.username, u.total_points, u.games_played, u.accuracy_rate
        ORDER BY u.total_points DESC
      `);

      // Garage Door Data Entries - Main data collection table for ML training
      db.run(`
        CREATE TABLE IF NOT EXISTS garage_door_data_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,

          -- Address and Location
          address TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          street_view_url TEXT,

          -- Garage Door Measurements
          garage_door_count INTEGER NOT NULL,
          garage_door_width REAL NOT NULL,
          garage_door_height REAL NOT NULL,
          garage_door_type TEXT NOT NULL CHECK (garage_door_type IN ('single', 'double', 'triple', 'commercial', 'custom')),
          garage_door_material TEXT CHECK (garage_door_material IN ('steel', 'wood', 'aluminum', 'composite', 'glass', 'other')),
          door_size TEXT NOT NULL, -- Standardized size string like "8x7 feet"

          -- Data Quality
          confidence_level INTEGER DEFAULT 3 CHECK (confidence_level BETWEEN 1 AND 5),
          notes TEXT,

          -- Verification
          is_verified BOOLEAN DEFAULT 0,
          verified_by_user_id INTEGER,
          verified_at DATETIME,
          verification_notes TEXT,

          -- Timestamps
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (verified_by_user_id) REFERENCES users (id)
        )
      `);

      // Training Data View - Clean data for ML model training
      db.run(`
        CREATE VIEW IF NOT EXISTS training_data AS
        SELECT
          gde.id,
          gde.address,
          gde.latitude,
          gde.longitude,
          gde.street_view_url,
          gde.garage_door_count,
          gde.garage_door_width,
          gde.garage_door_height,
          gde.garage_door_type,
          gde.garage_door_material,
          gde.door_size,
          gde.confidence_level,
          gde.is_verified,
          u.username as submitted_by,
          v.username as verified_by,
          gde.created_at
        FROM garage_door_data_entries gde
        JOIN users u ON gde.user_id = u.id
        LEFT JOIN users v ON gde.verified_by_user_id = v.id
        WHERE gde.confidence_level >= 3  -- Only include confident submissions
        ORDER BY gde.created_at DESC
      `);

      // Validation Game Results - Track game performance against verified data
      db.run(`
        CREATE TABLE IF NOT EXISTS validation_game_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          data_entry_id INTEGER NOT NULL,
          session_id TEXT NOT NULL,

          -- User's guess
          guess_door_count INTEGER NOT NULL,
          guess_door_width REAL NOT NULL,
          guess_door_height REAL NOT NULL,
          guess_door_type TEXT NOT NULL,
          confidence_level INTEGER NOT NULL,

          -- Results
          accuracy_score REAL NOT NULL,
          points_earned INTEGER NOT NULL,
          is_correct BOOLEAN NOT NULL,
          time_taken REAL,

          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (data_entry_id) REFERENCES garage_door_data_entries (id)
        )
      `);

      // Indexes for new tables
      db.run(`CREATE INDEX IF NOT EXISTS idx_game_questions_difficulty ON game_questions(difficulty)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_game_questions_active ON game_questions(is_active)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_question_game_results_user_id ON question_game_results(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_question_game_results_question_id ON question_game_results(question_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id)`);

      // Indexes for data entries
      db.run(`CREATE INDEX IF NOT EXISTS idx_garage_door_data_entries_user_id ON garage_door_data_entries(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_garage_door_data_entries_address ON garage_door_data_entries(address)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_garage_door_data_entries_verified ON garage_door_data_entries(is_verified)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_garage_door_data_entries_door_size ON garage_door_data_entries(door_size)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_garage_door_data_entries_created_at ON garage_door_data_entries(created_at)`);

      // Indexes for validation game results
      db.run(`CREATE INDEX IF NOT EXISTS idx_validation_game_results_user_id ON validation_game_results(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_validation_game_results_data_entry_id ON validation_game_results(data_entry_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_validation_game_results_created_at ON validation_game_results(created_at)`);

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
