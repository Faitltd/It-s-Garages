/**
 * Bing Maps Streetside Service
 * Implements Bing Maps REST Imagery API for Streetside panoramas
 */

import axios, { AxiosResponse, AxiosError } from 'axios';
// Note: geodesy import will be handled differently in production
// For now, implementing our own bearing calculation
import { securityService } from './securityService';
import { auditLogger } from './auditLogger';
import {
  StreetsideMetadataRequest,
  StreetsideMetadataResponse,
  StreetsideResource,
  PanoramaStitchRequest,
  PanoramaStitchResponse,
  BearingCalculation,
  StreetsideError,
  CubeFace
} from '../types/bingMaps';

export interface BingStreetViewRequest {
  lat: number;
  lng: number;
  size?: string;
  heading?: number;
  pitch?: number;
  fov?: number;
}

export interface BingStreetViewResponse {
  imageUrl: string;
  metadata: {
    originalBearing: number;
    calculatedBearing: number;
    distance: number;
    fov: number;
    pitch: number;
  };
  success: boolean;
  error?: string;
}

export class BingMapsService {
  private static instance: BingMapsService;
  private readonly baseUrl = 'https://dev.virtualearth.net/REST/v1';
  private readonly timeout = 10000; // 10 seconds
  private readonly maxRetries = 3;

  private constructor() {}

  public static getInstance(): BingMapsService {
    if (!BingMapsService.instance) {
      BingMapsService.instance = new BingMapsService();
    }
    return BingMapsService.instance;
  }

  /**
   * Get Street View URL using Bing Maps Streetside
   */
  public async getStreetViewUrl(request: BingStreetViewRequest): Promise<BingStreetViewResponse> {
    const startTime = Date.now();
    
    try {
      // Get Streetside metadata
      const metadata = await this.getStreetsideMetadata(request.lat, request.lng);
      
      if (!metadata || metadata.resourceSets.length === 0 || metadata.resourceSets[0]?.resources.length === 0) {
        throw new Error('No Streetside imagery available for this location');
      }

      const resource = metadata.resourceSets[0]!.resources[0]!;
      
      // Calculate bearing to building (if we had building coordinates)
      // For now, use the panorama's default orientation or provided heading
      const bearing = request.heading !== undefined ? request.heading : (resource.orientation || 0);
      
      // Generate panorama URL
      const imageUrl = await this.generatePanoramaUrl(resource, {
        bearing,
        pitch: request.pitch || -10,
        fov: request.fov || 90,
        size: request.size || '480x480'
      });

      const responseTime = Date.now() - startTime;
      
      await auditLogger.logApiUsage({
        provider: 'bing',
        keyType: 'streetside',
        usageCount: 1,
        responseTime,
        cached: false
      });

      return {
        imageUrl,
        metadata: {
          originalBearing: resource.orientation || 0,
          calculatedBearing: bearing,
          distance: 0, // Would calculate if we had building coordinates
          fov: request.fov || 90,
          pitch: request.pitch || -10
        },
        success: true
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await auditLogger.logSecurityEvent({
        event: 'BING_STREETSIDE_ERROR',
        provider: 'bing',
        severity: 'MEDIUM',
        timestamp: new Date(),
        details: { 
          request: this.sanitizeRequest(request),
          error: errorMessage,
          responseTime: Date.now() - startTime
        }
      });

      return {
        imageUrl: this.getPlaceholderUrl(request.size || '480x480'),
        metadata: {
          originalBearing: 0,
          calculatedBearing: request.heading || 0,
          distance: 0,
          fov: request.fov || 90,
          pitch: request.pitch || -10
        },
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get Streetside metadata for a location
   */
  public async getStreetsideMetadata(lat: number, lng: number): Promise<StreetsideMetadataResponse | null> {
    try {
      const apiKey = await securityService.getSecureApiKey('bing', 'streetside');
      
      const url = `${this.baseUrl}/Imagery/MetaData/Streetside/${lat},${lng}`;
      const params = {
        key: apiKey,
        output: 'json',
        includeImageryProviders: false
      };

      const response = await this.makeRequest<StreetsideMetadataResponse>(url, params);
      
      if (response.statusCode !== 200) {
        throw new Error(`Bing Maps API error: ${response.statusDescription}`);
      }

      return response;

    } catch (error) {
      console.error('Failed to get Streetside metadata:', error);
      return null;
    }
  }

  /**
   * Calculate bearing between two points using haversine formula
   */
  public calculateBearing(fromLat: number, fromLng: number, toLat: number, toLng: number): BearingCalculation {
    try {
      // Convert to radians
      const lat1 = fromLat * Math.PI / 180;
      const lat2 = toLat * Math.PI / 180;
      const deltaLng = (toLng - fromLng) * Math.PI / 180;

      // Calculate bearing
      const y = Math.sin(deltaLng) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
      const bearing = Math.atan2(y, x) * 180 / Math.PI;

      // Calculate distance using Haversine formula
      const R = 6371000; // Earth's radius in meters
      const deltaLat = (toLat - fromLat) * Math.PI / 180;
      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      return {
        fromLat,
        fromLng,
        toLat,
        toLng,
        bearing: (bearing + 360) % 360, // Normalize to 0-360
        distance,
        method: 'haversine'
      };

    } catch (error) {
      console.error('Bearing calculation failed:', error);

      return {
        fromLat,
        fromLng,
        toLat,
        toLng,
        bearing: 0,
        distance: 0,
        method: 'haversine'
      };
    }
  }

  /**
   * Generate panorama URL from Streetside resource
   */
  private async generatePanoramaUrl(
    resource: StreetsideResource, 
    options: { bearing: number; pitch: number; fov: number; size: string }
  ): Promise<string> {
    
    // For now, return a constructed URL based on Bing Maps Streetside tile system
    // This is a simplified implementation - full implementation would involve:
    // 1. Determining which cube face to use based on bearing
    // 2. Calculating tile coordinates
    // 3. Fetching and stitching tiles
    // 4. Applying perspective transformation
    
    const subdomain = resource.imageUrlSubdomains?.[0] || 't0';
    const faceId = this.calculateCubeFace(options.bearing);
    const tileId = this.calculateTileId(options.fov, options.size);
    
    // Replace placeholders in imageUrl template
    let imageUrl = resource.imageUrl || '';
    imageUrl = imageUrl.replace('{subdomain}', subdomain);
    imageUrl = imageUrl.replace('{faceId}', faceId.toString());
    imageUrl = imageUrl.replace('{tileId}', tileId);
    
    return imageUrl;
  }

  /**
   * Calculate which cube face to use based on bearing
   */
  private calculateCubeFace(bearing: number): CubeFace {
    // Normalize bearing to 0-360
    const normalizedBearing = (bearing + 360) % 360;
    
    // Map bearing to cube faces
    if (normalizedBearing >= 315 || normalizedBearing < 45) {
      return CubeFace.FRONT;
    } else if (normalizedBearing >= 45 && normalizedBearing < 135) {
      return CubeFace.RIGHT;
    } else if (normalizedBearing >= 135 && normalizedBearing < 225) {
      return CubeFace.BACK;
    } else {
      return CubeFace.LEFT;
    }
  }

  /**
   * Calculate tile ID based on FOV and size
   */
  private calculateTileId(fov: number, size: string): string {
    // Simplified tile calculation
    // Real implementation would consider zoom level, tile coordinates, etc.
    const [widthStr] = size.split('x');
    const width = parseInt(widthStr || '480', 10) || 480;
    const level = width > 640 ? 3 : width > 320 ? 2 : 1;
    
    // Return center tile for the level
    const tilesPerSide = Math.pow(2, level - 1);
    const centerTile = Math.floor(tilesPerSide / 2);
    
    return `${level}_${centerTile}_${centerTile}`;
  }

  /**
   * Make HTTP request with retry logic and error handling
   */
  private async makeRequest<T>(url: string, params: Record<string, any>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response: AxiosResponse<T> = await axios.get(url, {
          params,
          timeout: this.timeout,
          headers: {
            'User-Agent': 'GarageDoorGame/1.0',
            'Accept': 'application/json'
          }
        });

        return response.data;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;
          
          // Don't retry on client errors (4xx)
          if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
            break;
          }
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * Get placeholder URL for failed requests
   */
  private getPlaceholderUrl(size: string): string {
    return `https://via.placeholder.com/${size}/cccccc/666666?text=Streetside+Unavailable`;
  }

  /**
   * Sanitize request for logging
   */
  private sanitizeRequest(request: BingStreetViewRequest): any {
    return {
      lat: request.lat,
      lng: request.lng,
      size: request.size,
      heading: request.heading,
      pitch: request.pitch,
      fov: request.fov
    };
  }
}

export const bingMapsService = BingMapsService.getInstance();
