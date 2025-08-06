import express from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { auditDataAccess } from '../middleware/auditMiddleware';
import { googleApiService } from '../services/googleApiService';
import { db } from '../config/database';
import Joi from 'joi';
import {
  getRandomCentennialAddress,
  searchCentennialAddresses,
  getCentennialAddressWithStreetView,
  getCentennialAddressStats
} from '../services/centennialAddressService';
import { filterResidentialAddresses } from '../scripts/filterResidentialAddresses';
import { MLDataService, MLBatchExportOptions } from '../services/mlDataService';
import { mlDataEntrySchema, MLDataValidation } from '../schemas/mlDataSchemas';

const router = express.Router();

// Validation schema for reverse geocoding
const reverseGeocodeSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required()
});

// ML-standardized validation schema for data entry
const dataEntrySchema = mlDataEntrySchema;

interface DataEntry {
  address: string;
  garage_door_count: number;
  garage_door_width: number;
  garage_door_height: number;
  garage_door_type: string;
  notes?: string;
  confidence_level: number;
}

/**
 * Search addresses from Centennial addresses database
 */
router.get('/search-addresses',
  authenticate,
  auditDataAccess('data_entry', 'search_addresses'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const query = req.query.q as string;

      if (!query || query.length < 2) {
        res.json({
          success: true,
          suggestions: []
        });
        return;
      }

      // Search Centennial addresses database
      const addresses = await searchCentennialAddresses(query, 5);

      // Transform to match frontend expectations
      const suggestions = addresses.map(addr => ({
        address: addr.address || addr.name,
        description: `${addr.name !== addr.address ? addr.name + ' - ' : ''}Centennial, CO`
      }));

      res.json({
        success: true,
        suggestions: suggestions
      });

    } catch (error) {
      console.error('Address search error:', error);
      res.json({
        success: true,
        suggestions: [] // Return empty array on error to not break UI
      });
    }
  }
);

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
 * Get next Centennial address for validation game (POST method for session tracking)
 */
router.post('/centennial-address',
  authenticate,
  auditDataAccess('data_entry', 'get_centennial_address_game'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { sessionId } = req.body;
      console.log('Getting next address for validation game session:', sessionId);

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
      console.error('Error getting Centennial address for validation game:', error);
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
          
          // Get Street View image using coordinates for better accuracy - optimized size
          streetViewUrl = googleApiService.buildStreetViewUrl({
            lat: coordinates.lat,
            lng: coordinates.lng,
            size: '480x480', // Optimized size: 44% smaller for faster loading
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
      const doorSize = (data.garage_door_width === 0 || data.garage_door_height === 0)
        ? 'N/A'
        : `${data.garage_door_width}x${data.garage_door_height} feet`;
      
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
        garage_door_type, door_size, notes, confidence_level,
        street_view_url, latitude, longitude, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run([
      data.userId,
      data.address,
      data.garage_door_count,
      data.garage_door_width,
      data.garage_door_height,
      data.garage_door_type,
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
          garage_door_type = ?, door_size = ?,
          notes = ?, confidence_level = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);

    stmt.run([
      data.garage_door_count,
      data.garage_door_width,
      data.garage_door_height,
      data.garage_door_type,
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
        db.all(query, [], (err, rows) => {
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
        db.get(statsQuery, [], (err, row) => {
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

/**
 * Filter addresses for residential properties using Overpass API
 * This is an admin endpoint to batch process addresses
 */
router.post('/filter-residential',
  authenticate,
  auditDataAccess('data_entry', 'filter_residential'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      // Check if user has admin privileges (you might want to add role checking)
      const userId = (req.user as any)?.id;

      // Start the filtering process in the background
      console.log(`Starting residential filtering process initiated by user ${userId}`);

      // Run filtering asynchronously
      filterResidentialAddresses()
        .then(() => {
          console.log('Residential filtering completed successfully');
        })
        .catch((error: any) => {
          console.error('Residential filtering failed:', error);
        });

      res.json({
        success: true,
        message: 'Residential filtering process started. Check server logs for progress.'
      });

    } catch (error) {
      console.error('Filter residential error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to start residential filtering'
        }
      });
    }
  }
);

/**
 * Export ML-ready training data with standardized formatting
 */
router.get('/ml-export/training',
  authenticate,
  auditDataAccess('data_entry', 'ml_export_training'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const options: MLBatchExportOptions = {
        format: (req.query.format as any) || 'json',
        include_images: req.query.include_images === 'true',
        confidence_threshold: parseFloat(req.query.confidence_threshold as string) || 0.6,
        verified_only: req.query.verified_only !== 'false',
        batch_size: parseInt(req.query.batch_size as string) || 1000
      };

      if (req.query.start_date && req.query.end_date) {
        options.date_range = {
          start: req.query.start_date as string,
          end: req.query.end_date as string
        };
      }

      const trainingData = await MLDataService.exportTrainingData(options);

      // Set appropriate headers for ML data consumption
      res.set({
        'Content-Type': 'application/json',
        'X-ML-Data-Version': '2.0.0',
        'X-Data-Count': trainingData.length.toString(),
        'X-Export-Timestamp': new Date().toISOString(),
        'X-Confidence-Threshold': options.confidence_threshold.toString(),
        'X-Verified-Only': options.verified_only.toString()
      });

      res.json({
        success: true,
        metadata: {
          version: '2.0.0',
          export_timestamp: new Date().toISOString(),
          record_count: trainingData.length,
          confidence_threshold: options.confidence_threshold,
          verified_only: options.verified_only,
          data_separation: 'ground_truth_only'
        },
        data: trainingData
      });

    } catch (error) {
      console.error('ML training data export error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to export ML training data',
          code: 'ML_EXPORT_ERROR'
        }
      });
    }
  }
);

/**
 * Export ML-ready validation data (user guesses) for model performance analysis
 */
router.get('/ml-export/validation',
  authenticate,
  auditDataAccess('data_entry', 'ml_export_validation'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const options: MLBatchExportOptions = {
        format: (req.query.format as any) || 'json',
        include_images: false, // Validation data doesn't need images
        confidence_threshold: 0, // Include all validation attempts
        verified_only: false,
        batch_size: parseInt(req.query.batch_size as string) || 1000
      };

      if (req.query.start_date && req.query.end_date) {
        options.date_range = {
          start: req.query.start_date as string,
          end: req.query.end_date as string
        };
      }

      const validationData = await MLDataService.exportValidationData(options);

      res.set({
        'Content-Type': 'application/json',
        'X-ML-Data-Version': '2.0.0',
        'X-Data-Count': validationData.length.toString(),
        'X-Export-Timestamp': new Date().toISOString(),
        'X-Data-Type': 'validation_guesses'
      });

      res.json({
        success: true,
        metadata: {
          version: '2.0.0',
          export_timestamp: new Date().toISOString(),
          record_count: validationData.length,
          data_type: 'validation_guesses',
          data_separation: 'user_predictions_only'
        },
        data: validationData
      });

    } catch (error) {
      console.error('ML validation data export error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to export ML validation data',
          code: 'ML_VALIDATION_EXPORT_ERROR'
        }
      });
    }
  }
);

/**
 * Stream large ML datasets for efficient processing with progress tracking
 */
router.get('/ml-export/stream',
  authenticate,
  auditDataAccess('data_entry', 'ml_export_stream'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const options: MLBatchExportOptions = {
        format: 'jsonl', // JSON Lines for streaming
        include_images: req.query.include_images === 'true',
        confidence_threshold: parseFloat(req.query.confidence_threshold as string) || 0.6,
        verified_only: req.query.verified_only !== 'false',
        batch_size: parseInt(req.query.batch_size as string) || 100 // Smaller batches for streaming
      };

      res.set({
        'Content-Type': 'application/x-ndjson',
        'X-ML-Data-Version': '2.0.0',
        'Transfer-Encoding': 'chunked',
        'X-Stream-Format': 'progress-enabled'
      });

      // Stream data in batches with progress tracking
      for await (const { batch, progress } of MLDataService.streamTrainingData(options)) {
        // Send progress metadata as comment line
        res.write(`# Progress: ${progress.total_processed} records processed, ${progress.completion_percentage?.toFixed(1) || 'unknown'}% complete\n`);

        // Send actual data
        for (const record of batch) {
          res.write(JSON.stringify(record) + '\n');
        }

        // Flush to ensure real-time streaming
        if (res.flush) {
          res.flush();
        }
      }

      res.write('# Export completed\n');
      res.end();

    } catch (error) {
      console.error('ML streaming export error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: {
            message: 'Failed to stream ML data',
            code: 'ML_STREAM_ERROR'
          }
        });
      }
    }
  }
);

/**
 * Batch data quality validation endpoint
 */
router.post('/ml-export/validate-quality',
  authenticate,
  auditDataAccess('data_entry', 'ml_quality_validation'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const options: MLBatchExportOptions = {
        format: 'json',
        include_images: false,
        confidence_threshold: parseFloat(req.body.confidence_threshold) || 0.6,
        verified_only: req.body.verified_only !== false,
        batch_size: parseInt(req.body.batch_size) || 1000,
        date_range: req.body.date_range
      };

      const trainingData = await MLDataService.exportTrainingData(options);
      const qualityReport = MLDataService.validateBatchQuality(trainingData);

      res.json({
        success: true,
        metadata: {
          version: '2.0.0',
          validation_timestamp: new Date().toISOString(),
          record_count: trainingData.length,
          validation_type: 'batch_quality_assessment'
        },
        quality_report: qualityReport,
        recommendations: {
          data_usability: qualityReport.overall_quality >= 0.7 ? 'suitable_for_ml' : 'needs_improvement',
          suggested_actions: qualityReport.recommendations,
          quality_threshold_met: qualityReport.overall_quality >= options.confidence_threshold
        }
      });

    } catch (error) {
      console.error('ML quality validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to validate data quality',
          code: 'ML_QUALITY_VALIDATION_ERROR'
        }
      });
    }
  }
);

/**
 * Batch processing status endpoint for long-running operations
 */
router.get('/ml-export/status/:operation_id',
  authenticate,
  auditDataAccess('data_entry', 'ml_export_status'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const operationId = req.params.operation_id;

      // In a real implementation, this would check a job queue or cache
      // For now, return a mock status
      res.json({
        success: true,
        operation_id: operationId,
        status: 'completed', // 'pending', 'in_progress', 'completed', 'failed'
        progress: {
          total_records: 1000,
          processed_records: 1000,
          completion_percentage: 100,
          estimated_time_remaining: 0
        },
        result: {
          export_url: `/api/data-entry/ml-export/download/${operationId}`,
          format: 'json',
          file_size_bytes: 2048000,
          record_count: 1000
        },
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });

    } catch (error) {
      console.error('ML export status error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get export status',
          code: 'ML_EXPORT_STATUS_ERROR'
        }
      });
    }
  }
);

export default router;
