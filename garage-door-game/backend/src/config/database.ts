import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

// Test SQLite3 module loading
console.log('🔄 Testing SQLite3 module...');
try {
  console.log('✅ SQLite3 version:', sqlite3.VERSION);
  console.log('✅ SQLite3 module loaded successfully');
} catch (error) {
  console.error('❌ Failed to load SQLite3 module:', error);
  throw error;
}

// Use in-memory database for Cloud Run to avoid filesystem issues
const getDatabasePath = () => {
  // Check if we're in Cloud Run environment
  if (process.env.NODE_ENV === 'production' || process.env.K_SERVICE) {
    console.log('🗄️ Cloud Run detected - using in-memory database');
    // Use writable /tmp in Cloud Run to persist within revision lifetime
    return process.env.DATABASE_URL ? process.env.DATABASE_URL.replace('sqlite:', '') : '/tmp/garage_game.db';
  }

  // Local development - use file-based database
  if (process.env.DATABASE_URL) {
    const dbPath = process.env.DATABASE_URL.replace('sqlite:', '');
    console.log('🗄️ Using DATABASE_URL:', process.env.DATABASE_URL, '-> Path:', dbPath);
    return dbPath;
  }

  const defaultPath = process.env.DATABASE_PATH || './database/garage_game.db';
  console.log('🗄️ Using default database path:', defaultPath);
  return defaultPath;
};

const DATABASE_PATH = getDatabasePath();
console.log('🗄️ Final database path:', DATABASE_PATH);

// Only create directory for file-based databases
if (DATABASE_PATH !== ':memory:') {
  const dbDir = path.dirname(DATABASE_PATH);
  console.log('🗄️ Database directory:', dbDir);
  console.log('🗄️ Directory exists:', fs.existsSync(dbDir));

  if (!fs.existsSync(dbDir)) {
    console.log('🗄️ Creating database directory:', dbDir);
    try {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log('✅ Database directory created successfully');
    } catch (error) {
      console.error('❌ Failed to create database directory:', error);
      throw error;
    }
  } else {
    console.log('✅ Database directory already exists');
  }
} else {
  console.log('✅ Using in-memory database - no directory needed');
}

// Enable verbose mode in development
const sqlite = process.env.NODE_ENV === 'development' ? sqlite3.verbose() : sqlite3;

console.log('🔄 Attempting to connect to SQLite database...');
console.log('🔄 SQLite3 module loaded successfully');

export const db = new sqlite.Database(DATABASE_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    console.error('❌ Database path:', DATABASE_PATH);
    if (DATABASE_PATH !== ':memory:') {
      console.error('❌ Database directory exists:', fs.existsSync(path.dirname(DATABASE_PATH)));
      console.error('❌ Database file exists:', fs.existsSync(DATABASE_PATH));
      console.error('❌ Database directory permissions:', (() => {
        try {
          const stats = fs.statSync(path.dirname(DATABASE_PATH));
          return `mode: ${stats.mode.toString(8)}, uid: ${stats.uid}, gid: ${stats.gid}`;
        } catch (e) {
          return `Error getting stats: ${e}`;
        }
      })());
    }
    console.error('❌ Full error:', err);
    console.error('❌ Error code:', (err as any).code);
    console.error('❌ Error errno:', (err as any).errno);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database at:', DATABASE_PATH);
  if (DATABASE_PATH === ':memory:') {
    console.log('✅ Using in-memory database - data will not persist between restarts');
  }
  console.log('✅ Database connection established successfully');
});

// Database schema initialization
export const initializeDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log('🔄 Starting database schema initialization...');
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          data_submissions_count INTEGER DEFAULT 0,
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



      // Data submissions table - Comprehensive ML training data collection
      db.run(`
        CREATE TABLE IF NOT EXISTS data_submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,

          -- Location data
          address TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          address_source TEXT DEFAULT 'manual', -- 'gps', 'manual', 'approximate'

          -- Door measurements
          garage_door_count INTEGER NOT NULL DEFAULT 1,
          garage_door_width REAL,
          garage_door_height REAL,

          -- ML Training Tags - Door characteristics
          door_size_category TEXT, -- 'single', 'double', 'custom'
          door_material TEXT, -- 'wood', 'steel', 'aluminum', 'composite', 'vinyl', 'glass'
          door_style TEXT, -- 'traditional', 'carriage_house', 'contemporary', 'modern', 'custom'
          door_condition TEXT, -- 'new', 'good', 'fair', 'poor'

          -- ML Training Tags - Visibility and quality
          visibility_quality TEXT, -- 'clear', 'partially_obscured', 'poor_lighting', 'distant'
          image_quality TEXT, -- 'high', 'medium', 'low'
          weather_conditions TEXT, -- 'clear', 'overcast', 'rainy', 'snowy'

          -- Legacy fields (for backward compatibility)
          garage_door_size TEXT, -- Deprecated, use door_size_category
          material TEXT, -- Deprecated, use door_material
          color TEXT, -- Deprecated
          style TEXT, -- Deprecated, use door_style

          -- Additional data
          notes TEXT,
          photo_path TEXT,
          confidence_level INTEGER DEFAULT 3,
          status TEXT DEFAULT 'pending',

          -- Timestamps
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



      // Indexes for data entries
      db.run(`CREATE INDEX IF NOT EXISTS idx_garage_door_data_entries_user_id ON garage_door_data_entries(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_garage_door_data_entries_address ON garage_door_data_entries(address)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_garage_door_data_entries_verified ON garage_door_data_entries(is_verified)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_garage_door_data_entries_door_size ON garage_door_data_entries(door_size)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_garage_door_data_entries_created_at ON garage_door_data_entries(created_at)`);

      // Indexes for data submissions
      db.run(`CREATE INDEX IF NOT EXISTS idx_data_submissions_user_id ON data_submissions(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_data_submissions_address ON data_submissions(address)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_data_submissions_created_at ON data_submissions(created_at)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_data_submissions_door_material ON data_submissions(door_material)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_data_submissions_door_style ON data_submissions(door_style)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_validation_game_results_created_at ON validation_game_results(created_at)`);

      // Simple game locations table - For basic game functionality
      db.run(`
        CREATE TABLE IF NOT EXISTS game_locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          address TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          has_garage_door BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Add well-known residential locations with confirmed Street View coverage
      db.run(`
        INSERT OR IGNORE INTO game_locations (id, address, latitude, longitude, has_garage_door) VALUES
        (1, '1234 Middlefield Rd, Palo Alto, CA', 37.4419, -122.1430, 1),
        (2, '2345 Castro St, Mountain View, CA', 37.3861, -122.0839, 1),
        (3, '3456 Stevens Creek Blvd, Cupertino, CA', 37.3230, -122.0322, 1),
        (4, '4567 El Camino Real, Los Altos, CA', 37.3688, -122.1077, 1),
        (5, '5678 Homestead Rd, Sunnyvale, CA', 37.3688, -122.0363, 1),
        (6, '6789 Almaden Expy, San Jose, CA', 37.3382, -121.8863, 1),
        (7, '7890 Fremont Blvd, Fremont, CA', 37.5485, -121.9886, 1),
        (8, '8901 Woodside Rd, Redwood City, CA', 37.4852, -122.2364, 1),
        (9, '9012 Foster City Blvd, Foster City, CA', 37.5585, -122.2711, 1),
        (10, '1023 Ralston Ave, Belmont, CA', 37.5202, -122.2758, 1),
        (11, '1134 University Ave, Palo Alto, CA', 37.4486, -122.1597, 1),
        (12, '1245 California St, Mountain View, CA', 37.3894, -122.0819, 1)
      `);

      // Index for game locations
      db.run(`CREATE INDEX IF NOT EXISTS idx_game_locations_lat_lng ON game_locations(latitude, longitude)`);

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
