import Joi from 'joi';

/**
 * ML-Ready Data Validation Schemas
 * Ensures consistent data formatting for machine learning pipelines
 */

// Standardized garage door types for ML classification
export const GARAGE_DOOR_TYPES = [
  'single',
  'double', 
  'triple',
  'commercial',
  'custom'
] as const;

// Standardized materials for ML feature engineering
export const GARAGE_DOOR_MATERIALS = [
  'steel',
  'wood', 
  'aluminum',
  'composite',
  'glass',
  'other'
] as const;

// Common garage door sizes for ML training (width x height in feet)
export const STANDARD_GARAGE_SIZES = [
  '8x7', '9x7', '10x7', '12x7', '16x7', '18x7',
  '8x8', '9x8', '10x8', '12x8', '16x8', '18x8',
  '8x9', '9x9', '10x9', '12x9', '16x9', '18x9'
] as const;

/**
 * ML Training Data Schema - Ground Truth Labels
 * Strict validation for clean ML training data
 */
export const mlTrainingDataSchema = Joi.object({
  // Identifiers
  id: Joi.number().integer().positive().required(),
  data_source: Joi.string().valid('ground_truth', 'verified_entry', 'expert_annotation').required(),
  
  // Location (normalized)
  address: Joi.string().min(10).max(200).required(),
  latitude: Joi.number().min(-90).max(90).precision(6).required(),
  longitude: Joi.number().min(-180).max(180).precision(6).required(),
  
  // Image data (standardized)
  image_url: Joi.string().uri().required(),
  image_size: Joi.string().valid('480x480').required(), // Standardized after Phase 1
  image_heading: Joi.number().min(0).max(360).optional(),
  image_pitch: Joi.number().min(-90).max(90).optional(),
  
  // Ground truth labels (normalized)
  garage_door_count: Joi.number().integer().min(0).max(10).required(),
  garage_door_width_ft: Joi.number().min(0).max(50).precision(1).required(),
  garage_door_height_ft: Joi.number().min(0).max(20).precision(1).required(),
  garage_door_type: Joi.string().valid(...GARAGE_DOOR_TYPES).required(),
  garage_door_material: Joi.string().valid(...GARAGE_DOOR_MATERIALS).optional(),
  
  // Quality metrics (normalized 0.0-1.0)
  confidence_score: Joi.number().min(0).max(1).precision(2).required(),
  verification_status: Joi.string().valid('verified', 'pending', 'rejected').required(),
  data_quality_score: Joi.number().min(0).max(1).precision(2).required(),
  
  // Timestamps (ISO 8601)
  created_timestamp: Joi.string().isoDate().required(),
  verified_timestamp: Joi.string().isoDate().optional(),
  data_version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required(), // Semantic versioning
  
  // Bias detection fields
  geographic_region: Joi.string().optional(),
  building_age_category: Joi.string().valid('new', 'modern', 'older', 'historic', 'unknown').optional(),
  socioeconomic_indicator: Joi.string().optional()
});

/**
 * ML Validation Data Schema - User Predictions
 * For model performance analysis and bias detection
 */
export const mlValidationDataSchema = Joi.object({
  // Identifiers
  id: Joi.number().integer().positive().required(),
  user_id: Joi.number().integer().positive().required(),
  ground_truth_id: Joi.number().integer().positive().required(),
  session_id: Joi.string().uuid().required(),
  
  // User predictions (normalized)
  predicted_door_count: Joi.number().integer().min(0).max(10).required(),
  predicted_door_width_ft: Joi.number().min(0).max(50).precision(1).required(),
  predicted_door_height_ft: Joi.number().min(0).max(20).precision(1).required(),
  predicted_door_type: Joi.string().valid(...GARAGE_DOOR_TYPES).required(),
  user_confidence: Joi.number().min(0).max(1).precision(2).required(), // Normalized from 1-5 scale
  
  // Performance metrics
  accuracy_score: Joi.number().min(0).max(1).precision(3).required(),
  prediction_error_width: Joi.number().min(0).precision(2).required(),
  prediction_error_height: Joi.number().min(0).precision(2).required(),
  response_time_seconds: Joi.number().min(0).precision(2).required(),
  
  // User context for bias analysis
  user_experience_level: Joi.number().integer().min(0).optional(),
  user_accuracy_history: Joi.number().min(0).max(1).precision(3).optional(),
  
  // Timestamps
  created_timestamp: Joi.string().isoDate().required(),
  data_version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required()
});

/**
 * ML Batch Export Options Schema
 */
export const mlBatchExportOptionsSchema = Joi.object({
  format: Joi.string().valid('json', 'csv', 'jsonl').default('json'),
  include_images: Joi.boolean().default(false),
  confidence_threshold: Joi.number().min(0).max(1).default(0.6),
  verified_only: Joi.boolean().default(true),
  date_range: Joi.object({
    start: Joi.string().isoDate().required(),
    end: Joi.string().isoDate().required()
  }).optional(),
  geographic_bounds: Joi.object({
    north: Joi.number().min(-90).max(90).required(),
    south: Joi.number().min(-90).max(90).required(),
    east: Joi.number().min(-180).max(180).required(),
    west: Joi.number().min(-180).max(180).required()
  }).optional(),
  batch_size: Joi.number().integer().min(1).max(10000).default(1000)
});

/**
 * Data Entry Schema with ML Standardization
 * Ensures consistent data format from user input to ML pipeline
 */
export const mlDataEntrySchema = Joi.object({
  // Address validation
  address: Joi.string().min(10).max(200).required(),
  
  // Garage door measurements (standardized units)
  garage_door_count: Joi.number().integer().min(0).max(10).required(),
  garage_door_width: Joi.number().min(0).max(50).precision(1).required(),
  garage_door_height: Joi.number().min(0).max(20).precision(1).required(),
  garage_door_type: Joi.string().valid(...GARAGE_DOOR_TYPES).required(),
  garage_door_material: Joi.string().valid(...GARAGE_DOOR_MATERIALS).optional(),
  
  // Quality indicators
  confidence_level: Joi.number().integer().min(1).max(5).default(3),
  notes: Joi.string().max(500).optional(),
  
  // Optional metadata for ML enhancement
  building_style: Joi.string().optional(),
  estimated_age: Joi.string().valid('new', 'modern', 'older', 'historic', 'unknown').optional(),
  neighborhood_type: Joi.string().optional()
});

/**
 * Validation Game Response Schema with ML Formatting
 */
export const mlValidationGameSchema = Joi.object({
  session_id: Joi.string().uuid().required(),
  
  // User predictions
  garage_door_count: Joi.number().integer().min(0).max(10).required(),
  garage_door_width: Joi.number().min(0).max(50).precision(1).required(),
  garage_door_height: Joi.number().min(0).max(20).precision(1).required(),
  garage_door_type: Joi.string().valid(...GARAGE_DOOR_TYPES).required(),
  confidence: Joi.number().integer().min(1).max(5).required(),
  
  // Game state
  skipped: Joi.boolean().default(false),
  notVisible: Joi.boolean().default(false),
  
  // Timing data for ML analysis
  time_taken: Joi.number().min(0).precision(2).optional(),
  
  // User context
  user_notes: Joi.string().max(200).optional()
});

/**
 * ML Model Prediction Schema
 * For storing AI model predictions alongside human data
 */
export const mlModelPredictionSchema = Joi.object({
  // Model metadata
  model_id: Joi.string().required(),
  model_version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required(),
  prediction_timestamp: Joi.string().isoDate().required(),
  
  // Input data reference
  image_url: Joi.string().uri().required(),
  address_id: Joi.number().integer().positive().optional(),
  
  // Model predictions
  predicted_door_count: Joi.number().integer().min(0).max(10).required(),
  predicted_door_width_ft: Joi.number().min(0).max(50).precision(1).required(),
  predicted_door_height_ft: Joi.number().min(0).max(20).precision(1).required(),
  predicted_door_type: Joi.string().valid(...GARAGE_DOOR_TYPES).required(),
  
  // Model confidence and uncertainty
  prediction_confidence: Joi.number().min(0).max(1).precision(3).required(),
  uncertainty_score: Joi.number().min(0).max(1).precision(3).optional(),
  
  // Model performance metadata
  inference_time_ms: Joi.number().min(0).precision(2).required(),
  model_accuracy_estimate: Joi.number().min(0).max(1).precision(3).optional(),
  
  // Bias detection
  prediction_bias_score: Joi.number().min(0).max(1).precision(3).optional(),
  fairness_metrics: Joi.object().optional()
});

/**
 * Data Quality Assessment Schema
 */
export const dataQualitySchema = Joi.object({
  record_id: Joi.number().integer().positive().required(),
  data_type: Joi.string().valid('training', 'validation', 'prediction').required(),
  
  // Quality metrics
  completeness_score: Joi.number().min(0).max(1).precision(3).required(),
  accuracy_score: Joi.number().min(0).max(1).precision(3).required(),
  consistency_score: Joi.number().min(0).max(1).precision(3).required(),
  timeliness_score: Joi.number().min(0).max(1).precision(3).required(),
  
  // Overall quality
  overall_quality_score: Joi.number().min(0).max(1).precision(3).required(),
  quality_grade: Joi.string().valid('A', 'B', 'C', 'D', 'F').required(),
  
  // Quality issues
  identified_issues: Joi.array().items(Joi.string()).optional(),
  recommended_actions: Joi.array().items(Joi.string()).optional(),
  
  // Assessment metadata
  assessed_at: Joi.string().isoDate().required(),
  assessed_by: Joi.string().valid('automated', 'human', 'hybrid').required()
});

/**
 * Utility functions for ML data validation
 */
export const MLDataValidation = {
  /**
   * Normalize confidence score from 1-5 scale to 0.0-1.0
   */
  normalizeConfidence: (confidence: number): number => {
    return Math.max(0, Math.min(1, (confidence - 1) / 4));
  },

  /**
   * Validate garage door size string format
   */
  validateSizeString: (size: string): boolean => {
    return STANDARD_GARAGE_SIZES.includes(size as any);
  },

  /**
   * Calculate data quality score
   */
  calculateQualityScore: (data: any): number => {
    let score = 0.5; // Base score
    
    // Add points for completeness
    if (data.address && data.latitude && data.longitude) score += 0.2;
    if (data.image_url) score += 0.1;
    if (data.garage_door_material) score += 0.1;
    
    // Add points for verification
    if (data.verification_status === 'verified') score += 0.1;
    
    return Math.min(1.0, score);
  },

  /**
   * Detect potential bias in data
   */
  detectBias: (dataset: any[]): any => {
    // Simplified bias detection
    const typeDistribution = dataset.reduce((acc, item) => {
      acc[item.garage_door_type] = (acc[item.garage_door_type] || 0) + 1;
      return acc;
    }, {});

    const regionDistribution = dataset.reduce((acc, item) => {
      acc[item.geographic_region || 'unknown'] = (acc[item.geographic_region || 'unknown'] || 0) + 1;
      return acc;
    }, {});

    return {
      type_distribution: typeDistribution,
      region_distribution: regionDistribution,
      total_records: dataset.length,
      bias_detected: false // Placeholder for more sophisticated bias detection
    };
  }
};
