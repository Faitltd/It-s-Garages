import express from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { auditDataAccess } from '../middleware/auditMiddleware';
import { googleApiService } from '../services/googleApiService';
import { db } from '../config/database';
import Joi from 'joi';

const router = express.Router();

// Validation schema for reverse geocoding
const reverseGeocodeSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required()
});

// Validation schema for data entry
const dataEntrySchema = Joi.object({
  address: Joi.string().required().min(10).max(200),
  garage_door_count: Joi.number().integer().min(1).max(10).required(),
  garage_door_width: Joi.number().positive().required(),
  garage_door_height: Joi.number().positive().required(),
  garage_door_type: Joi.string().valid('single', 'double', 'triple', 'commercial', 'custom').required(),
  garage_door_material: Joi.string().valid('steel', 'wood', 'aluminum', 'composite', 'glass', 'other').optional(),
  notes: Joi.string().max(500).optional(),
  confidence_level: Joi.number().min(1).max(5).default(3) // 1-5 scale
});

interface DataEntry {
  address: string;
  garage_door_count: number;
  garage_door_width: number;
  garage_door_height: number;
  garage_door_type: string;
  garage_door_material?: string;
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
          
          // Get Street View image using coordinates for better accuracy
          streetViewUrl = googleApiService.buildStreetViewUrl({
            lat: coordinates.lat,
            lng: coordinates.lng,
            size: '640x640',
            heading: 0, // Face north initially
            pitch: -10, // Slightly downward to capture garage doors
            fov: 90
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
      data.garage_door_material || null,
      data.doorSize,
      data.notes || null,
      data.confidence_level,
      data.streetViewUrl || null,
      data.coordinates.lat || null,
      data.coordinates.lng || null
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

async function getDataEntries(limit: number, offset: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      SELECT 
        gde.*,
        u.username,
        CASE WHEN gde.verified_at IS NOT NULL THEN 1 ELSE 0 END as is_verified
      FROM garage_door_data_entries gde
      JOIN users u ON gde.user_id = u.id
      ORDER BY gde.created_at DESC
      LIMIT ? OFFSET ?
    `);

    stmt.all([limit, offset], (err, rows) => {
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
    db.get('SELECT COUNT(*) as count FROM garage_door_data_entries', (err, row: any) => {
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
    const stmt = db.prepare(`
      SELECT 
        gde.*,
        u.username,
        CASE WHEN gde.verified_at IS NOT NULL THEN 1 ELSE 0 END as is_verified
      FROM garage_door_data_entries gde
      JOIN users u ON gde.user_id = u.id
      WHERE gde.id = ?
    `);

    stmt.get([id], (err, row) => {
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
    
    const stmt = db.prepare(`
      UPDATE garage_door_data_entries 
      SET garage_door_count = ?, garage_door_width = ?, garage_door_height = ?,
          garage_door_type = ?, garage_door_material = ?, door_size = ?,
          notes = ?, confidence_level = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);

    stmt.run([
      data.garage_door_count,
      data.garage_door_width,
      data.garage_door_height,
      data.garage_door_type,
      data.garage_door_material || null,
      doorSize,
      data.notes || null,
      data.confidence_level,
      id,
      userId
    ], function(err) {
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
    const stmt = db.prepare(`
      UPDATE garage_door_data_entries 
      SET verified_by_user_id = ?, verified_at = CURRENT_TIMESTAMP, 
          verification_notes = ?, is_verified = ?
      WHERE id = ?
    `);

    stmt.run([verifierId, notes || null, verified ? 1 : 0, id], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });

    stmt.finalize();
  });
}

export default router;
