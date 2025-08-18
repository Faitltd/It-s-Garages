import express from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { auditDataAccess } from '../middleware/auditMiddleware';
import { googleApiService } from '../services/googleApiService';
import { getDb } from '../config/dbAccessor';
import Joi from 'joi';
import {
  getRandomCentennialAddress,
  searchCentennialAddresses,
  getCentennialAddressWithStreetView,
  getCentennialAddressStats
} from '../services/centennialAddressService';

const router = express.Router();

// Validation schema for reverse geocoding
const reverseGeocodeSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required()
});

// Validation schema for comprehensive data entry with ML training tags
const dataEntrySchema = Joi.object({
  // Basic data
  address: Joi.string().required().min(10).max(200),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  address_source: Joi.string().valid('gps', 'manual', 'approximate').default('manual'),

  // Door measurements
  garage_door_count: Joi.number().integer().min(1).max(10).required(),
  garage_door_width: Joi.number().positive().required(),
  garage_door_height: Joi.number().positive().required(),

  // ML Training Tags - Door characteristics
  door_size_category: Joi.string().valid('single', 'double', 'custom').required(),
  door_material: Joi.string().valid('wood', 'steel', 'aluminum', 'composite', 'vinyl', 'glass').required(),
  door_style: Joi.string().valid('traditional', 'carriage_house', 'contemporary', 'modern', 'custom').required(),
  door_condition: Joi.string().valid('new', 'good', 'fair', 'poor').required(),

  // ML Training Tags - Visibility and quality
  visibility_quality: Joi.string().valid('clear', 'partially_obscured', 'poor_lighting', 'distant').required(),
  image_quality: Joi.string().valid('high', 'medium', 'low').required(),
  weather_conditions: Joi.string().valid('clear', 'overcast', 'rainy', 'snowy').required(),

  // Additional data
  notes: Joi.string().max(500).optional(),
  confidence_level: Joi.number().min(1).max(5).default(3)
});

interface DataEntry {
  // Basic data
  address: string;
  latitude?: number;
  longitude?: number;
  address_source: string;

  // Door measurements
  garage_door_count: number;
  garage_door_width: number;
  garage_door_height: number;

  // ML Training Tags
  door_size_category: string;
  door_material: string;
  door_style: string;
  door_condition: string;
  visibility_quality: string;
  image_quality: string;
  weather_conditions: string;

  // Additional data
  notes?: string;
  confidence_level: number;
}

/**
 * Reverse geocode coordinates to address
 */
router.post('/reverse-geocode',
  authenticate,
  validate(reverseGeocodeSchema),
  auditDataAccess('data_entry', 'reverse_geocode'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { latitude, longitude } = req.body;

      // Use Google Maps Geocoding API to get address from coordinates
      const address = await googleApiService.reverseGeocode(latitude, longitude);

      if (address) {
        res.json({
          success: true,
          address: address
        });
      } else {
        res.status(404).json({
          success: false,
          error: {
            message: 'Could not determine address from coordinates'
          }
        });
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to reverse geocode coordinates'
        }
      });
    }
  }
);

/**
 * Get a random Centennial address for data entry
 */
router.get('/centennial-address',
  authenticate,
  auditDataAccess('data_entry', 'get_centennial_address'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const addressData = await getCentennialAddressWithStreetView();

      if (addressData) {
        res.json({
          success: true,
          data: {
            id: addressData.address.id,
            address: addressData.address.address,
            latitude: addressData.address.latitude,
            longitude: addressData.address.longitude,
            streetViewUrl: addressData.streetViewUrl,
            hasKnownGarageDoor: addressData.address.has_garage_door,
            knownGarageDoorCount: addressData.address.garage_door_count,
            knownGarageDoorWidth: addressData.address.garage_door_width,
            knownGarageDoorHeight: addressData.address.garage_door_height
          }
        });
      } else {
        res.status(404).json({
          success: false,
          error: {
            message: 'No Centennial addresses available'
          }
        });
      }
    } catch (error) {
      console.error('Error getting Centennial address:', error);
      next(error);
    }
  }
);

/**
 * Search Centennial addresses
 */
router.get('/centennial-addresses/search',
  authenticate,
  auditDataAccess('data_entry', 'search_centennial_addresses'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const searchTerm = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!searchTerm || searchTerm.length < 3) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Search term must be at least 3 characters'
          }
        });
        return;
      }

      const addresses = await searchCentennialAddresses(searchTerm, limit);

      res.json({
        success: true,
        data: addresses.map(addr => ({
          id: addr.id,
          address: addr.address,
          latitude: addr.latitude,
          longitude: addr.longitude,
          hasKnownGarageDoor: addr.has_garage_door,
          knownGarageDoorCount: addr.garage_door_count
        }))
      });
    } catch (error) {
      console.error('Error searching Centennial addresses:', error);
      next(error);
    }
  }
);

/**
 * Get Centennial address statistics
 */
router.get('/centennial-addresses/stats',
  authenticate,
  auditDataAccess('data_entry', 'centennial_stats'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const stats = await getCentennialAddressStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting Centennial address stats:', error);
      next(error);
    }
  }
);

/**
 * Submit garage door data with automatic Street View image capture
 */
router.post('/submit',
  authenticate,
  validate(dataEntrySchema),
  auditDataAccess('data_entry', 'submit'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const data: DataEntry = req.body;

      // Get Street View image for the address
      let streetViewUrl = '';
      let coordinates = { lat: 0, lng: 0 };
      
      try {
        // First, geocode the address to get coordinates
        const geocodeResult = await googleApiService.geocodeAddress(data.address);
        if (geocodeResult) {
          coordinates = geocodeResult;
          
          // Get Street View image using coordinates with optimal heading for garage doors
          streetViewUrl = await googleApiService.buildOptimalStreetViewUrl({
            lat: coordinates.lat,
            lng: coordinates.lng,
            size: '640x640',
            pitch: 10, // Slightly upward to capture house fronts and garage doors
            fov: 90,
            preferredSide: 'right' // Try right side of street first for better garage visibility
          });
        }
      } catch (error) {
        console.error('Error getting Street View image:', error);
        // Continue without image - we'll store the data anyway
      }

      // Calculate standardized door size string
      const doorSize = `${data.garage_door_width}x${data.garage_door_height} feet`;
      
      // Save to database
      const entryId = await saveDataEntry({
        ...data,
        userId,
        streetViewUrl,
        coordinates,
        doorSize
      });

      res.json({
        success: true,
        data: {
          id: entryId,
          message: 'Data entry saved successfully',
          streetViewUrl: streetViewUrl || null,
          coordinates: streetViewUrl ? coordinates : null
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get all data entries for training data export
 */
router.get('/export',
  authenticate,
  auditDataAccess('data_entry', 'export'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = (page - 1) * limit;

      const entries = await getDataEntries(limit, offset);
      const total = await getDataEntriesCount();

      res.json({
        success: true,
        data: {
          entries,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get data entry by ID for verification/editing
 */
router.get('/:id',
  authenticate,
  auditDataAccess('data_entry', 'view'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const entryId = parseInt(req.params.id || '0');
      const entry = await getDataEntryById(entryId);

      if (!entry) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Data entry not found',
            code: 'ENTRY_NOT_FOUND'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: entry
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update data entry (for corrections/verification)
 */
router.put('/:id',
  authenticate,
  validate(dataEntrySchema),
  auditDataAccess('data_entry', 'update'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const entryId = parseInt(req.params.id || '0');
      const userId = req.user!.userId;
      const data: DataEntry = req.body;

      const updated = await updateDataEntry(entryId, userId, data);

      if (!updated) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Data entry not found or access denied',
            code: 'ENTRY_NOT_FOUND'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          message: 'Data entry updated successfully'
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * Mark data entry as verified (for quality control)
 */
router.post('/:id/verify',
  authenticate,
  auditDataAccess('data_entry', 'verify'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const entryId = parseInt(req.params.id || '0');
      const userId = req.user!.userId;
      const { verified, notes } = req.body;

      await verifyDataEntry(entryId, userId, verified, notes);

      res.json({
        success: true,
        data: {
          message: `Data entry ${verified ? 'verified' : 'marked as needs review'}`
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// Database functions
async function saveDataEntry(data: any): Promise<number> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!db) return reject(new Error('Database not ready'));
    const stmt = db.prepare(`
      INSERT INTO data_submissions (
        user_id, address, latitude, longitude, address_source,
        garage_door_count, garage_door_width, garage_door_height,
        door_size_category, door_material, door_style, door_condition,
        visibility_quality, image_quality, weather_conditions,
        garage_door_size, material, style, notes, photo_path, confidence_level,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    // Use provided coordinates or geocoded coordinates
    const lat = data.latitude || data.coordinates?.lat || null;
    const lng = data.longitude || data.coordinates?.lng || null;

    stmt.run([
      data.userId,
      data.address,
      lat,
      lng,
      data.address_source || 'manual',
      data.garage_door_count,
      data.garage_door_width,
      data.garage_door_height,
      data.door_size_category,
      data.door_material,
      data.door_style,
      data.door_condition,
      data.visibility_quality,
      data.image_quality,
      data.weather_conditions,
      // Legacy fields for backward compatibility
      data.doorSize || `${data.garage_door_width}x${data.garage_door_height}`,
      data.door_material, // Copy to legacy field
      data.door_style, // Copy to legacy field
      data.notes || null,
      data.streetViewUrl || null,
      data.confidence_level
    ], function(this: any, err: any) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.lastID);
    });

    stmt.finalize();
  });
}

async function getDataEntries(limit: number, offset: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!db) return reject(new Error('Database not ready'));
    const stmt = db.prepare(`
      SELECT
        ds.*,
        u.username
      FROM data_submissions ds
      JOIN users u ON ds.user_id = u.id
      ORDER BY ds.created_at DESC
      LIMIT ? OFFSET ?
    `);

    stmt.all([limit, offset], (err: any, rows: any[]) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });

    stmt.finalize();
  });
}

async function getDataEntriesCount(): Promise<number> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!db) return reject(new Error('Database not ready'));
    db.get('SELECT COUNT(*) as count FROM data_submissions', (err: any, row: any) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row.count);
    });
  });
}

async function getDataEntryById(id: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!db) return reject(new Error('Database not ready'));
    const stmt = db.prepare(`
      SELECT 
        gde.*,
        u.username,
        CASE WHEN gde.verified_at IS NOT NULL THEN 1 ELSE 0 END as is_verified
      FROM garage_door_data_entries gde
      JOIN users u ON gde.user_id = u.id
      WHERE gde.id = ?
    `);

    stmt.get([id], (err: any, row: any) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row || null);
    });

    stmt.finalize();
  });
}

async function updateDataEntry(id: number, userId: number, data: DataEntry): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const doorSize = `${data.garage_door_width}x${data.garage_door_height} feet`;
    
    const db = getDb();
    if (!db) return reject(new Error('Database not ready'));
    const stmt = db.prepare(`
      UPDATE data_submissions
      SET garage_door_count = ?, garage_door_width = ?, garage_door_height = ?,
          door_size_category = ?, door_material = ?, garage_door_size = ?,
          notes = ?, confidence_level = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);

    stmt.run([
      data.garage_door_count,
      data.garage_door_width,
      data.garage_door_height,
      data.door_size_category,
      data.door_material,
      doorSize,
      data.notes || null,
      data.confidence_level,
      id,
      userId
    ], function(this: any, err: any) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.changes > 0);
    });

    stmt.finalize();
  });
}

async function verifyDataEntry(id: number, verifierId: number, verified: boolean, notes?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!db) return reject(new Error('Database not ready'));
    const stmt = db.prepare(`
      UPDATE garage_door_data_entries 
      SET verified_by_user_id = ?, verified_at = CURRENT_TIMESTAMP, 
          verification_notes = ?, is_verified = ?
      WHERE id = ?
    `);

    stmt.run([verifierId, notes || null, verified ? 1 : 0, id], function(this: any, err: any) {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });

    stmt.finalize();
  });
}

/**
 * Export all garage door data for ML training
 */
router.get('/export',
  authenticate,
  auditDataAccess('data_entry', 'export'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      // Get all data entries with user information
      const query = `
        SELECT
          de.id,
          de.address,
          de.latitude,
          de.longitude,
          de.street_view_url,
          de.garage_door_count,
          de.garage_door_width,
          de.garage_door_height,
          de.garage_door_type,
          de.garage_door_material,
          de.notes,
          de.confidence_level,
          de.created_at,
          u.username,
          u.email,
          -- Validation game results for this entry
          COUNT(vgr.id) as validation_count,
          AVG(vgr.accuracy) as avg_validation_accuracy,
          AVG(vgr.points_earned) as avg_points_earned
        FROM data_entries de
        LEFT JOIN users u ON de.user_id = u.id
        LEFT JOIN validation_game_results vgr ON de.id = vgr.data_entry_id
        GROUP BY de.id
        ORDER BY de.created_at DESC
      `;

      const entries = await new Promise<any[]>((resolve, reject) => {
        const db = getDb();
        if (!db) return reject(new Error('Database not ready'));
        db.all(query, [], (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      // Get summary statistics
      const statsQuery = `
        SELECT
          COUNT(*) as total_entries,
          COUNT(DISTINCT user_id) as unique_contributors,
          AVG(garage_door_count) as avg_door_count,
          AVG(garage_door_width) as avg_door_width,
          AVG(garage_door_height) as avg_door_height,
          AVG(confidence_level) as avg_confidence,
          MIN(created_at) as first_entry,
          MAX(created_at) as latest_entry
        FROM data_entries
      `;

      const stats = await new Promise<any>((resolve, reject) => {
        const db = getDb();
        if (!db) return reject(new Error('Database not ready'));
        db.get(statsQuery, [], (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      res.json({
        success: true,
        data: {
          entries: entries,
          statistics: stats,
          export_timestamp: new Date().toISOString(),
          total_count: entries.length
        }
      });

    } catch (error) {
      console.error('Data export error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to export data'
        }
      });
    }
  }
);

export default router;
