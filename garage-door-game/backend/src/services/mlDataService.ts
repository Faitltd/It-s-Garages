import { db } from '../config/database';

/**
 * ML-Ready Data Schemas and Interfaces
 * Ensures consistent data formatting for machine learning pipelines
 */

export interface MLTrainingRecord {
  // Unique identifiers
  id: number;
  data_source: 'ground_truth' | 'verified_entry' | 'expert_annotation';
  
  // Location data (normalized)
  address: string;
  latitude: number;
  longitude: number;
  
  // Image data (standardized)
  image_url: string;
  image_size: '480x480'; // Standardized after Phase 1 optimization
  image_heading?: number;
  image_pitch?: number;
  
  // Ground truth labels (normalized)
  garage_door_count: number;
  garage_door_width_ft: number;
  garage_door_height_ft: number;
  garage_door_type: 'single' | 'double' | 'triple' | 'commercial' | 'custom';
  garage_door_material?: 'steel' | 'wood' | 'aluminum' | 'composite' | 'glass' | 'other';
  
  // Quality metrics
  confidence_score: number; // 0.0 - 1.0 normalized
  verification_status: 'verified' | 'pending' | 'rejected';
  data_quality_score: number; // Computed quality metric
  
  // Metadata for ML pipeline
  created_timestamp: string; // ISO 8601 format
  verified_timestamp?: string;
  data_version: string; // For model versioning
  
  // Bias detection fields
  geographic_region?: string;
  building_age_category?: string;
  socioeconomic_indicator?: string;
}

export interface MLValidationRecord {
  // Unique identifiers
  id: number;
  user_id: number;
  ground_truth_id: number; // Links to MLTrainingRecord
  session_id: string;
  
  // User prediction (normalized)
  predicted_door_count: number;
  predicted_door_width_ft: number;
  predicted_door_height_ft: number;
  predicted_door_type: string;
  user_confidence: number; // 1-5 scale, normalized to 0.0-1.0
  
  // Performance metrics
  accuracy_score: number; // 0.0 - 1.0
  prediction_error_width: number; // Absolute error in feet
  prediction_error_height: number; // Absolute error in feet
  response_time_seconds: number;
  
  // User context for bias analysis
  user_experience_level?: number; // Games played
  user_accuracy_history?: number; // Historical accuracy
  
  // Metadata
  created_timestamp: string;
  data_version: string;
}

export interface MLBatchExportOptions {
  format: 'json' | 'csv' | 'jsonl'; // JSON Lines for streaming
  include_images: boolean;
  confidence_threshold: number; // Minimum confidence for inclusion
  verified_only: boolean;
  date_range?: {
    start: string;
    end: string;
  };
  geographic_bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  batch_size: number; // For streaming exports
}

/**
 * ML Data Service - Provides clean, formatted data for machine learning
 */
export class MLDataService {
  private static readonly DATA_VERSION = '2.0.0'; // Updated for Phase 2 optimizations
  
  /**
   * Export ground truth data for ML training with proper formatting
   */
  static async exportTrainingData(options: MLBatchExportOptions): Promise<MLTrainingRecord[]> {
    const {
      confidence_threshold = 0.6,
      verified_only = true,
      date_range,
      geographic_bounds,
      batch_size = 1000
    } = options;

    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          gde.id,
          'ground_truth' as data_source,
          gde.address,
          gde.latitude,
          gde.longitude,
          gde.street_view_url as image_url,
          '480x480' as image_size,
          gde.garage_door_count,
          gde.garage_door_width as garage_door_width_ft,
          gde.garage_door_height as garage_door_height_ft,
          gde.garage_door_type,
          gde.garage_door_material,
          (gde.confidence_level / 5.0) as confidence_score,
          CASE 
            WHEN gde.is_verified = 1 THEN 'verified'
            ELSE 'pending'
          END as verification_status,
          gde.created_at as created_timestamp,
          gde.verified_at as verified_timestamp
        FROM garage_door_data_entries gde
        WHERE gde.confidence_level >= ?
      `;

      const params: any[] = [confidence_threshold * 5]; // Convert back to 1-5 scale

      if (verified_only) {
        query += ` AND gde.is_verified = 1`;
      }

      if (date_range) {
        query += ` AND gde.created_at BETWEEN ? AND ?`;
        params.push(date_range.start, date_range.end);
      }

      if (geographic_bounds) {
        query += ` AND gde.latitude BETWEEN ? AND ? AND gde.longitude BETWEEN ? AND ?`;
        params.push(
          geographic_bounds.south,
          geographic_bounds.north,
          geographic_bounds.west,
          geographic_bounds.east
        );
      }

      query += ` ORDER BY gde.created_at DESC LIMIT ?`;
      params.push(batch_size);

      db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const trainingRecords: MLTrainingRecord[] = rows.map(row => ({
          ...row,
          confidence_score: Number(row.confidence_score),
          data_quality_score: this.calculateDataQualityScore(row),
          data_version: this.DATA_VERSION,
          geographic_region: this.getGeographicRegion(row.latitude, row.longitude),
          building_age_category: this.estimateBuildingAge(row.address),
        }));

        resolve(trainingRecords);
      });
    });
  }

  /**
   * Export validation game results for model performance analysis
   */
  static async exportValidationData(options: MLBatchExportOptions): Promise<MLValidationRecord[]> {
    const { batch_size = 1000, date_range } = options;

    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          vgr.id,
          vgr.user_id,
          vgr.data_entry_id as ground_truth_id,
          vgr.session_id,
          vgr.guess_door_count as predicted_door_count,
          vgr.guess_door_width as predicted_door_width_ft,
          vgr.guess_door_height as predicted_door_height_ft,
          vgr.guess_door_type as predicted_door_type,
          (vgr.confidence_level / 5.0) as user_confidence,
          vgr.accuracy_score,
          vgr.time_taken as response_time_seconds,
          vgr.created_at as created_timestamp,
          u.games_played as user_experience_level,
          u.accuracy_rate as user_accuracy_history
        FROM validation_game_results vgr
        JOIN users u ON vgr.user_id = u.id
        WHERE 1=1
      `;

      const params: any[] = [];

      if (date_range) {
        query += ` AND vgr.created_at BETWEEN ? AND ?`;
        params.push(date_range.start, date_range.end);
      }

      query += ` ORDER BY vgr.created_at DESC LIMIT ?`;
      params.push(batch_size);

      db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const validationRecords: MLValidationRecord[] = rows.map(row => ({
          ...row,
          user_confidence: Number(row.user_confidence),
          accuracy_score: Number(row.accuracy_score),
          prediction_error_width: this.calculatePredictionError(row, 'width'),
          prediction_error_height: this.calculatePredictionError(row, 'height'),
          data_version: this.DATA_VERSION,
        }));

        resolve(validationRecords);
      });
    });
  }

  /**
   * Calculate data quality score for ML training
   */
  private static calculateDataQualityScore(record: any): number {
    let score = 0.5; // Base score

    // Confidence contribution (0.3 weight)
    score += (record.confidence_score * 0.3);

    // Verification status (0.4 weight)
    if (record.verification_status === 'verified') {
      score += 0.4;
    }

    // Image availability (0.2 weight)
    if (record.image_url && record.image_url !== '') {
      score += 0.2;
    }

    // Location data quality (0.1 weight)
    if (record.latitude && record.longitude) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }

  /**
   * Calculate prediction error for validation analysis
   */
  private static calculatePredictionError(record: any, dimension: 'width' | 'height'): number {
    // This would need ground truth data joined in a real implementation
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Determine geographic region for bias analysis
   */
  private static getGeographicRegion(lat: number, lng: number): string {
    // Simplified region classification
    if (lat >= 39.0 && lat <= 40.0 && lng >= -105.5 && lng <= -104.5) {
      return 'centennial_co';
    }
    return 'unknown';
  }

  /**
   * Estimate building age category from address
   */
  private static estimateBuildingAge(address: string): string {
    // Simplified age estimation based on address patterns
    // In production, this would use property records or other data sources
    return 'unknown';
  }

  /**
   * Stream large datasets for ML processing with progress tracking
   */
  static async *streamTrainingData(options: MLBatchExportOptions): AsyncGenerator<{
    batch: MLTrainingRecord[];
    progress: {
      current_batch: number;
      total_processed: number;
      estimated_total?: number;
      completion_percentage?: number;
    };
  }, void, unknown> {
    let offset = 0;
    let batchNumber = 0;
    const { batch_size = 1000 } = options;

    // Get estimated total count for progress tracking
    const estimatedTotal = await this.getEstimatedRecordCount(options);

    while (true) {
      const batch = await this.exportTrainingDataWithOffset({
        ...options,
        batch_size,
        offset
      });

      if (batch.length === 0) {
        break;
      }

      batchNumber++;
      const totalProcessed = offset + batch.length;
      const completionPercentage = estimatedTotal > 0 ? (totalProcessed / estimatedTotal) * 100 : undefined;

      const progressData: {
        current_batch: number;
        total_processed: number;
        estimated_total?: number;
        completion_percentage?: number;
      } = {
        current_batch: batchNumber,
        total_processed: totalProcessed
      };

      if (estimatedTotal > 0) {
        progressData.estimated_total = estimatedTotal;
      }
      if (completionPercentage !== undefined) {
        progressData.completion_percentage = completionPercentage;
      }

      yield {
        batch,
        progress: progressData
      };

      offset += batch_size;

      if (batch.length < batch_size) {
        break; // Last batch
      }
    }
  }

  /**
   * Export training data with offset for streaming
   */
  private static async exportTrainingDataWithOffset(options: MLBatchExportOptions & { offset: number }): Promise<MLTrainingRecord[]> {
    const {
      confidence_threshold = 0.6,
      verified_only = true,
      date_range,
      geographic_bounds,
      batch_size = 1000,
      offset = 0
    } = options;

    return new Promise((resolve, reject) => {
      let query = `
        SELECT
          gde.id,
          'ground_truth' as data_source,
          gde.address,
          gde.latitude,
          gde.longitude,
          gde.street_view_url as image_url,
          '480x480' as image_size,
          gde.garage_door_count,
          gde.garage_door_width as garage_door_width_ft,
          gde.garage_door_height as garage_door_height_ft,
          gde.garage_door_type,
          gde.garage_door_material,
          (gde.confidence_level / 5.0) as confidence_score,
          CASE
            WHEN gde.is_verified = 1 THEN 'verified'
            ELSE 'pending'
          END as verification_status,
          gde.created_at as created_timestamp,
          gde.verified_at as verified_timestamp
        FROM garage_door_data_entries gde
        WHERE gde.confidence_level >= ?
      `;

      const params: any[] = [confidence_threshold * 5];

      if (verified_only) {
        query += ` AND gde.is_verified = 1`;
      }

      if (date_range) {
        query += ` AND gde.created_at BETWEEN ? AND ?`;
        params.push(date_range.start, date_range.end);
      }

      if (geographic_bounds) {
        query += ` AND gde.latitude BETWEEN ? AND ? AND gde.longitude BETWEEN ? AND ?`;
        params.push(
          geographic_bounds.south,
          geographic_bounds.north,
          geographic_bounds.west,
          geographic_bounds.east
        );
      }

      query += ` ORDER BY gde.created_at DESC LIMIT ? OFFSET ?`;
      params.push(batch_size, offset);

      db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const trainingRecords: MLTrainingRecord[] = rows.map(row => ({
          ...row,
          confidence_score: Number(row.confidence_score),
          data_quality_score: this.calculateDataQualityScore(row),
          data_version: this.DATA_VERSION,
          geographic_region: this.getGeographicRegion(row.latitude, row.longitude),
          building_age_category: this.estimateBuildingAge(row.address),
        }));

        resolve(trainingRecords);
      });
    });
  }

  /**
   * Get estimated record count for progress tracking
   */
  private static async getEstimatedRecordCount(options: MLBatchExportOptions): Promise<number> {
    const {
      confidence_threshold = 0.6,
      verified_only = true,
      date_range,
      geographic_bounds
    } = options;

    return new Promise((resolve, reject) => {
      let query = `
        SELECT COUNT(*) as count
        FROM garage_door_data_entries gde
        WHERE gde.confidence_level >= ?
      `;

      const params: any[] = [confidence_threshold * 5];

      if (verified_only) {
        query += ` AND gde.is_verified = 1`;
      }

      if (date_range) {
        query += ` AND gde.created_at BETWEEN ? AND ?`;
        params.push(date_range.start, date_range.end);
      }

      if (geographic_bounds) {
        query += ` AND gde.latitude BETWEEN ? AND ? AND gde.longitude BETWEEN ? AND ?`;
        params.push(
          geographic_bounds.south,
          geographic_bounds.north,
          geographic_bounds.west,
          geographic_bounds.east
        );
      }

      db.get(query, params, (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row?.count || 0);
        }
      });
    });
  }

  /**
   * Batch process data with error recovery
   */
  static async processBatchWithRecovery<T>(
    items: T[],
    processor: (item: T) => Promise<any>,
    options: {
      batch_size: number;
      max_retries: number;
      retry_delay_ms: number;
      on_progress?: (processed: number, total: number) => void;
      on_error?: (error: Error, item: T) => void;
    }
  ): Promise<{ successful: any[]; failed: { item: T; error: Error }[] }> {
    const { batch_size, max_retries, retry_delay_ms, on_progress, on_error } = options;
    const successful: any[] = [];
    const failed: { item: T; error: Error }[] = [];

    for (let i = 0; i < items.length; i += batch_size) {
      const batch = items.slice(i, i + batch_size);

      for (const item of batch) {
        let attempts = 0;
        let success = false;

        while (attempts < max_retries && !success) {
          try {
            const result = await processor(item);
            successful.push(result);
            success = true;
          } catch (error) {
            attempts++;
            if (attempts >= max_retries) {
              const err = error as Error;
              failed.push({ item, error: err });
              if (on_error) {
                on_error(err, item);
              }
            } else {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, retry_delay_ms));
            }
          }
        }
      }

      if (on_progress) {
        on_progress(Math.min(i + batch_size, items.length), items.length);
      }
    }

    return { successful, failed };
  }

  /**
   * Export data in multiple formats efficiently
   */
  static async exportToFormat(
    data: MLTrainingRecord[] | MLValidationRecord[],
    format: 'json' | 'csv' | 'jsonl'
  ): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);

      case 'jsonl':
        return data.map(record => JSON.stringify(record)).join('\n');

      case 'csv':
        if (data.length === 0) return '';

        const firstRecord = data[0];
        if (!firstRecord) return '';

        const headers = Object.keys(firstRecord);
        const csvRows = [
          headers.join(','),
          ...data.map(record =>
            headers.map(header => {
              const value = (record as any)[header];
              // Escape CSV values
              if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            }).join(',')
          )
        ];
        return csvRows.join('\n');

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Validate data quality across batch
   */
  static validateBatchQuality(data: MLTrainingRecord[]): {
    overall_quality: number;
    quality_distribution: Record<string, number>;
    issues: string[];
    recommendations: string[];
  } {
    if (data.length === 0) {
      return {
        overall_quality: 0,
        quality_distribution: {},
        issues: ['No data provided'],
        recommendations: ['Ensure data is available before validation']
      };
    }

    const qualityScores = data.map(record => record.data_quality_score);
    const overallQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;

    const qualityDistribution = qualityScores.reduce((acc, score) => {
      const bucket = Math.floor(score * 10) / 10; // Round to nearest 0.1
      acc[bucket.toString()] = (acc[bucket.toString()] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for common issues
    const lowQualityCount = qualityScores.filter(score => score < 0.5).length;
    if (lowQualityCount > data.length * 0.1) {
      issues.push(`${lowQualityCount} records have low quality scores (<0.5)`);
      recommendations.push('Review and improve data collection processes');
    }

    const unverifiedCount = data.filter(record => record.verification_status !== 'verified').length;
    if (unverifiedCount > data.length * 0.2) {
      issues.push(`${unverifiedCount} records are unverified`);
      recommendations.push('Increase verification efforts for better data quality');
    }

    return {
      overall_quality: overallQuality,
      quality_distribution: qualityDistribution,
      issues,
      recommendations
    };
  }
}
