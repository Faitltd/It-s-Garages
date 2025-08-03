import rateLimit from 'express-rate-limit';
import { createError } from '../middleware/errorHandler';

interface GoogleApiUsage {
  streetViewRequests: number;
  mapsRequests: number;
  lastReset: Date;
  dailyLimit: number;
}

class GoogleApiService {
  private usage: GoogleApiUsage;
  private streetViewApiKey: string;
  private mapsApiKey: string;

  constructor() {
    this.streetViewApiKey = this.getSecureApiKey('GOOGLE_STREET_VIEW_API_KEY');
    this.mapsApiKey = this.getSecureApiKey('GOOGLE_MAPS_API_KEY');
    
    this.usage = {
      streetViewRequests: 0,
      mapsRequests: 0,
      lastReset: new Date(),
      dailyLimit: parseInt(process.env.GOOGLE_API_DAILY_LIMIT || '1000')
    };
  }

  /**
   * Securely retrieve API key from environment
   */
  private getSecureApiKey(keyName: string): string {
    const apiKey = process.env[keyName];
    
    if (!apiKey) {
      throw new Error(`${keyName} environment variable is required`);
    }

    // Basic validation - Google API keys should start with 'AIza'
    if (!apiKey.startsWith('AIza')) {
      console.warn(`Warning: ${keyName} may not be a valid Google API key`);
    }

    return apiKey;
  }

  /**
   * Check if we're within API usage limits
   */
  private checkUsageLimit(apiType: 'streetView' | 'maps'): boolean {
    const now = new Date();
    const timeSinceReset = now.getTime() - this.usage.lastReset.getTime();
    const hoursElapsed = timeSinceReset / (1000 * 60 * 60);

    // Reset daily counter if 24 hours have passed
    if (hoursElapsed >= 24) {
      this.usage.streetViewRequests = 0;
      this.usage.mapsRequests = 0;
      this.usage.lastReset = now;
    }

    const totalRequests = this.usage.streetViewRequests + this.usage.mapsRequests;
    return totalRequests < this.usage.dailyLimit;
  }

  /**
   * Increment usage counter
   */
  private incrementUsage(apiType: 'streetView' | 'maps'): void {
    if (apiType === 'streetView') {
      this.usage.streetViewRequests++;
    } else {
      this.usage.mapsRequests++;
    }
  }

  /**
   * Get Street View API key with usage tracking
   */
  public getStreetViewApiKey(): string {
    if (!this.checkUsageLimit('streetView')) {
      throw createError('Daily Google API limit exceeded', 429);
    }

    this.incrementUsage('streetView');
    return this.streetViewApiKey;
  }

  /**
   * Get Maps API key with usage tracking
   */
  public getMapsApiKey(): string {
    if (!this.checkUsageLimit('maps')) {
      throw createError('Daily Google API limit exceeded', 429);
    }

    this.incrementUsage('maps');
    return this.mapsApiKey;
  }

  /**
   * Get current usage statistics
   */
  public getUsageStats(): GoogleApiUsage {
    return { ...this.usage };
  }

  /**
   * Validate API key format
   */
  public static validateApiKey(apiKey: string): boolean {
    // Google API keys are typically 39 characters long and start with 'AIza'
    return apiKey.length === 39 && apiKey.startsWith('AIza');
  }

  /**
   * Build Street View URL with proper parameters
   */
  public buildStreetViewUrl(params: {
    location?: string;
    lat?: number;
    lng?: number;
    size?: string;
    heading?: number;
    pitch?: number;
    fov?: number;
  }): string {
    const apiKey = this.getStreetViewApiKey();
    const baseUrl = 'https://maps.googleapis.com/maps/api/streetview';
    
    const urlParams = new URLSearchParams();
    
    // Location parameter (either location string or lat/lng)
    if (params.location) {
      urlParams.append('location', params.location);
    } else if (params.lat && params.lng) {
      urlParams.append('location', `${params.lat},${params.lng}`);
    } else {
      throw createError('Either location or lat/lng coordinates are required', 400);
    }
    
    // Optional parameters with defaults
    urlParams.append('size', params.size || '640x640');
    urlParams.append('key', apiKey);
    
    if (params.heading !== undefined) {
      urlParams.append('heading', params.heading.toString());
    }
    
    if (params.pitch !== undefined) {
      urlParams.append('pitch', params.pitch.toString());
    }
    
    if (params.fov !== undefined) {
      urlParams.append('fov', params.fov.toString());
    }

    return `${baseUrl}?${urlParams.toString()}`;
  }

  /**
   * Build Geocoding API URL
   */
  public buildGeocodingUrl(address: string): string {
    const apiKey = this.getMapsApiKey();
    const baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    
    const urlParams = new URLSearchParams();
    urlParams.append('address', address);
    urlParams.append('key', apiKey);

    return `${baseUrl}?${urlParams.toString()}`;
  }
}

// Create rate limiter for Google API endpoints
export const googleApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per minute
  message: {
    error: 'Too many Google API requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Singleton instance
export const googleApiService = new GoogleApiService();

// Export the class for testing
export { GoogleApiService };
