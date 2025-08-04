import { db } from '../config/database';
import { googleApiService } from './googleApiService';

/**
 * CORE GARAGE DOOR DATA SERVICE
 * This is the structured foundation to connect addresses to predicted door sizes
 */

export interface GarageDoorProperty {
  id?: number;
  address: string;
  lat: number;
  lng: number;
  garage_type: string;           // single, double, RV, golf-cart add-on, etc.
  garage_door_size: string;      // e.g., 8×7 ft, 16×7 ft, 18×8 ft
  door_width_ft?: number;        // Width in feet (extracted from size)
  door_height_ft?: number;       // Height in feet (extracted from size)
  confidence: number;            // Numeric score (0–1) when prediction is auto-generated
  source: string;                // human_verified | builder_spec | ai_prediction | game_submission
  photo_url?: string;            // Link to Street View image used
  street_view_heading?: number;  // Camera heading when photo was taken
  street_view_pitch?: number;    // Camera pitch when photo was taken
  last_verified?: Date;          // When this data was last verified
  verified_by_user_id?: number;  // User who verified this data
  notes?: string;                // Additional notes about the property
  building_style?: string;       // Ranch, Colonial, Modern, etc.
  driveway_type?: string;        // Straight, Curved, Circular, etc.
  created_at?: Date;
  updated_at?: Date;
}

export interface CVDetectionResult {
  id?: number;
  property_id: number;
  model_version: string;
  bbox_x1?: number;              // Bounding box coordinates (normalized 0-1)
  bbox_y1?: number;
  bbox_x2?: number;
  bbox_y2?: number;
  detected_type?: string;        // single, double, RV, etc.
  detected_size?: string;        // Predicted size (8×7 ft, etc.)
  confidence_score: number;      // Model confidence (0-1)
  raw_predictions?: string;      // JSON of all model predictions
  processing_time_ms?: number;   // Time taken for inference
  detection_timestamp?: Date;
}

export interface PriceEstimate {
  id?: number;
  property_id: number;
  door_size: string;
  door_type: string;
  material_type: string;         // standard, premium, custom
  material_cost: number;
  labor_cost: number;
  total_estimate: number;
  margin_percentage: number;     // Configurable margin
  removal_cost: number;          // Old door removal
  installation_complexity_multiplier: number;
  estimate_date?: Date;
  valid_until?: Date;
  created_by: string;            // system | user | admin
}

/**
 * GARAGE DOOR PROPERTY MANAGEMENT
 */
export class GarageDoorService {
  
  /**
   * Create or update garage door property
   */
  static async upsertProperty(property: GarageDoorProperty): Promise<number> {
    return new Promise((resolve, reject) => {
      // Extract dimensions from size string (e.g., "16×7 ft" -> width: 16, height: 7)
      const dimensions = this.extractDimensions(property.garage_door_size);
      
      const sql = `
        INSERT OR REPLACE INTO garage_door_properties (
          address, lat, lng, garage_type, garage_door_size, 
          door_width_ft, door_height_ft, confidence, source,
          photo_url, street_view_heading, street_view_pitch,
          last_verified, verified_by_user_id, notes, 
          building_style, driveway_type, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      
      const params = [
        property.address,
        property.lat,
        property.lng,
        property.garage_type,
        property.garage_door_size,
        dimensions.width || null,
        dimensions.height || null,
        property.confidence,
        property.source,
        property.photo_url,
        property.street_view_heading,
        property.street_view_pitch,
        property.last_verified,
        property.verified_by_user_id,
        property.notes,
        property.building_style,
        property.driveway_type
      ];
      
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Get property by address
   */
  static async getPropertyByAddress(address: string): Promise<GarageDoorProperty | null> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM garage_door_properties WHERE address = ?`;
      
      db.get(sql, [address], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * Get properties within radius of coordinates
   */
  static async getPropertiesNearby(lat: number, lng: number, radiusKm: number = 1): Promise<GarageDoorProperty[]> {
    return new Promise((resolve, reject) => {
      // Simple bounding box query (for more precision, use proper geospatial functions)
      const latDelta = radiusKm / 111; // Rough conversion: 1 degree ≈ 111 km
      const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
      
      const sql = `
        SELECT * FROM garage_door_properties 
        WHERE lat BETWEEN ? AND ? 
        AND lng BETWEEN ? AND ?
        ORDER BY confidence DESC
      `;
      
      const params = [
        lat - latDelta, lat + latDelta,
        lng - lngDelta, lng + lngDelta
      ];
      
      db.all(sql, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Extract dimensions from size string
   */
  private static extractDimensions(sizeString: string): { width: number | null, height: number | null } {
    // Match patterns like "16×7 ft", "8x7", "18 × 8 ft"
    const match = sizeString.match(/(\d+)\s*[×x]\s*(\d+)/);
    if (match && match[1] && match[2]) {
      return {
        width: parseInt(match[1]),
        height: parseInt(match[2])
      };
    }
    return { width: null, height: null };
  }

  /**
   * COMPUTER VISION INTEGRATION
   * Process address through Street View → CV Model → Size Prediction
   */
  static async processAddressWithCV(address: string, lat: number, lng: number): Promise<{
    property: GarageDoorProperty;
    detection: CVDetectionResult;
    estimate: PriceEstimate;
  }> {
    try {
      // 1. Get Street View image
      const streetViewUrl = googleApiService.buildStreetViewUrl({
        lat,
        lng,
        size: '640x640',
        heading: Math.floor(Math.random() * 360),
        pitch: -10,
        fov: 90
      });

      // 2. TODO: Run CV model on image (placeholder for now)
      const mockDetection = await this.mockCVDetection(streetViewUrl);

      // 3. Create property record
      const property: GarageDoorProperty = {
        address,
        lat,
        lng,
        garage_type: mockDetection.detected_type || 'double',
        garage_door_size: mockDetection.detected_size || '16×7 ft',
        confidence: mockDetection.confidence_score,
        source: 'ai_prediction',
        photo_url: streetViewUrl,
        street_view_heading: 45,
        street_view_pitch: -10
      };

      const propertyId = await this.upsertProperty(property);

      // 4. Store CV detection results
      const detection: CVDetectionResult = {
        property_id: propertyId,
        model_version: 'yolov8-garage-v1.0',
        detected_type: mockDetection.detected_type,
        detected_size: mockDetection.detected_size,
        confidence_score: mockDetection.confidence_score,
        processing_time_ms: 150
      };

      await this.storeCVDetection(detection);

      // 5. Generate price estimate
      const estimate = await this.generatePriceEstimate(propertyId, property.garage_door_size, property.garage_type);

      return { property, detection, estimate };

    } catch (error) {
      console.error('Error processing address with CV:', error);
      throw error;
    }
  }

  /**
   * Mock CV detection (replace with real model)
   */
  private static async mockCVDetection(imageUrl: string): Promise<{
    detected_type: string;
    detected_size: string;
    confidence_score: number;
  }> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Mock realistic predictions based on common garage door sizes
    const commonSizes = [
      { type: 'single', size: '8×7 ft', confidence: 0.85 },
      { type: 'double', size: '16×7 ft', confidence: 0.92 },
      { type: 'double', size: '16×8 ft', confidence: 0.88 },
      { type: 'double', size: '18×7 ft', confidence: 0.79 }
    ];

    const randomPrediction = commonSizes[Math.floor(Math.random() * commonSizes.length)];

    if (!randomPrediction) {
      // Fallback if no prediction found
      return {
        detected_type: 'double',
        detected_size: '16×7 ft',
        confidence_score: 0.75
      };
    }

    return {
      detected_type: randomPrediction.type,
      detected_size: randomPrediction.size,
      confidence_score: randomPrediction.confidence
    };
  }

  /**
   * Store CV detection results
   */
  private static async storeCVDetection(detection: CVDetectionResult): Promise<number> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO cv_detection_results (
          property_id, model_version, detected_type, detected_size,
          confidence_score, processing_time_ms
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        detection.property_id,
        detection.model_version,
        detection.detected_type,
        detection.detected_size,
        detection.confidence_score,
        detection.processing_time_ms
      ];
      
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Generate price estimate based on door specifications
   */
  private static async generatePriceEstimate(propertyId: number, doorSize: string, doorType: string): Promise<PriceEstimate> {
    // Price calculation logic based on door size and type
    const dimensions = this.extractDimensions(doorSize);
    const area = (dimensions.width || 16) * (dimensions.height || 7);
    
    // Base pricing per square foot
    const basePricePerSqFt = 25; // $25 per sq ft
    const materialCost = area * basePricePerSqFt;
    const laborCost = materialCost * 0.6; // 60% of material cost
    const margin = 0.20; // 20% margin
    const totalEstimate = (materialCost + laborCost) * (1 + margin);

    const estimate: PriceEstimate = {
      property_id: propertyId,
      door_size: doorSize,
      door_type: doorType,
      material_type: 'standard',
      material_cost: materialCost,
      labor_cost: laborCost,
      total_estimate: Math.round(totalEstimate),
      margin_percentage: margin,
      removal_cost: 150, // Standard removal cost
      installation_complexity_multiplier: 1.0,
      created_by: 'system'
    };

    // Store estimate in database
    await this.storePriceEstimate(estimate);
    
    return estimate;
  }

  /**
   * Store price estimate
   */
  private static async storePriceEstimate(estimate: PriceEstimate): Promise<number> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO price_estimates (
          property_id, door_size, door_type, material_type,
          material_cost, labor_cost, total_estimate, margin_percentage,
          removal_cost, installation_complexity_multiplier, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        estimate.property_id,
        estimate.door_size,
        estimate.door_type,
        estimate.material_type,
        estimate.material_cost,
        estimate.labor_cost,
        estimate.total_estimate,
        estimate.margin_percentage,
        estimate.removal_cost,
        estimate.installation_complexity_multiplier,
        estimate.created_by
      ];
      
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }
}

export default GarageDoorService;
