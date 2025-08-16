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
    try {
      this.streetViewApiKey = this.getSecureApiKey('GOOGLE_STREET_VIEW_API_KEY');
      this.mapsApiKey = this.getSecureApiKey('GOOGLE_MAPS_API_KEY');
    } catch (error) {
      console.warn('Google API keys not configured, using fallback mode');
      this.streetViewApiKey = '';
      this.mapsApiKey = '';
    }

    this.usage = {
      streetViewRequests: 0,
      mapsRequests: 0,
      lastReset: new Date(),
      dailyLimit: parseInt(process.env.GOOGLE_API_DAILY_LIMIT || '1000')
    };
  }

  /**
   * Securely retrieve API key from environment - with graceful fallback
   */
  private getSecureApiKey(keyName: string): string {
    const apiKey = process.env[keyName];

    if (!apiKey || apiKey === 'your-google-street-view-api-key' || apiKey === 'your-google-maps-api-key') {
      throw new Error(`${keyName} not configured`);
    }

    // Basic validation - Google API keys should start with 'AIza'
    if (!apiKey.startsWith('AIza')) {
      throw new Error(`${keyName} invalid format`);
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
   * Calculate optimal heading for residential garage door viewing
   * @param lat Latitude
   * @param lng Longitude
   * @param preferredSide 'right' or 'left' side of street (default: 'right')
   * @returns Promise<number> Calculated heading in degrees
   */
  public async calculateOptimalHeading(lat: number, lng: number, preferredSide: 'right' | 'left' = 'right'): Promise<number> {
    try {
      // Create a small offset to get street bearing
      const offsetDistance = 0.001; // ~100 meters
      const lat2 = lat + offsetDistance;

      // Use Directions API to get street bearing
      const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${lat},${lng}&destination=${lat2},${lng}&key=${this.getMapsApiKey()}`;

      const response = await fetch(directionsUrl);
      const data = await response.json() as any; // Type assertion for Google Directions API response

      if (data.routes && data.routes.length > 0 && data.routes[0].legs && data.routes[0].legs.length > 0) {
        const steps = data.routes[0].legs[0].steps;
        if (steps && steps.length > 0) {
          // Get the bearing from the first step
          const startLocation = steps[0].start_location;
          const endLocation = steps[0].end_location;

          // Calculate bearing between two points
          const streetBearing = this.calculateBearing(
            startLocation.lat, startLocation.lng,
            endLocation.lat, endLocation.lng
          );

          // Add 90 degrees for right side houses, 270 for left side
          const headingOffset = preferredSide === 'right' ? 90 : 270;
          return (streetBearing + headingOffset) % 360;
        }
      }

      // Fallback: try multiple common residential orientations
      const fallbackHeadings = [45, 135, 225, 315]; // NE, SE, SW, NW
      const randomIndex = Math.floor(Math.random() * fallbackHeadings.length);
      return fallbackHeadings[randomIndex] || 45; // Default to 45 if somehow undefined

    } catch (error) {
      console.warn('Could not calculate optimal heading, using fallback:', error);
      // Fallback to a reasonable residential heading
      return preferredSide === 'right' ? 45 : 315;
    }
  }

  /**
   * Calculate bearing between two geographic points
   * @param lat1 Start latitude
   * @param lng1 Start longitude
   * @param lat2 End latitude
   * @param lng2 End longitude
   * @returns Bearing in degrees (0-360)
   */
  private calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;

    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  /**
   * Build Street View URL with proper parameters and optional automatic heading calculation
   */
  public buildStreetViewUrl(params: {
    location?: string;
    lat?: number;
    lng?: number;
    size?: string;
    heading?: number;
    pitch?: number;
    fov?: number;
    autoHeading?: boolean;
    preferredSide?: 'right' | 'left';
  }): string {
    // Robust fallback for API key issues
    if (!this.streetViewApiKey) {
      console.warn('Street View API key not configured, using placeholder');
      return 'https://via.placeholder.com/640x640/cccccc/666666?text=Street+View+Unavailable';
    }

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

    // Optional parameters with defaults optimized for residential viewing
    urlParams.append('size', params.size || '640x640');
    urlParams.append('key', this.streetViewApiKey);

    // Add source parameter for better image quality
    urlParams.append('source', 'outdoor');

    if (params.heading !== undefined) {
      urlParams.append('heading', params.heading.toString());
    }

    // Default pitch optimized for garage door viewing
    if (params.pitch !== undefined) {
      urlParams.append('pitch', params.pitch.toString());
    } else {
      urlParams.append('pitch', '5'); // Slightly upward angle for better house view
    }

    // Default FOV optimized for residential viewing
    if (params.fov !== undefined) {
      urlParams.append('fov', params.fov.toString());
    } else {
      urlParams.append('fov', '80'); // Narrower field of view for better focus
    }

    return `${baseUrl}?${urlParams.toString()}`;
  }

  /**
   * Build Street View URL with automatic optimal heading calculation
   * This async version calculates the best heading to face residential buildings
   */
  public async buildOptimalStreetViewUrl(params: {
    location?: string;
    lat?: number;
    lng?: number;
    size?: string;
    heading?: number;
    pitch?: number;
    fov?: number;
    preferredSide?: 'right' | 'left';
  }): Promise<string> {
    // If heading is already provided, use the synchronous version
    if (params.heading !== undefined) {
      return this.buildStreetViewUrl(params);
    }

    // Calculate optimal heading if coordinates are available
    if (params.lat && params.lng) {
      try {
        const optimalHeading = await this.calculateOptimalHeading(
          params.lat,
          params.lng,
          params.preferredSide || 'right'
        );

        return this.buildStreetViewUrl({
          ...params,
          heading: optimalHeading
        });
      } catch (error) {
        console.warn('Failed to calculate optimal heading, using default:', error);
        // Fallback to default residential heading
        return this.buildStreetViewUrl({
          ...params,
          heading: 45 // Default NE facing for residential areas
        });
      }
    }

    // Fallback to synchronous version
    return this.buildStreetViewUrl(params);
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

  /**
   * Geocode an address to get coordinates
   */
  async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      if (!this.checkUsageLimit('maps')) {
        throw new Error('Google Maps API daily limit exceeded');
      }

      const encodedAddress = encodeURIComponent(address);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${this.mapsApiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      this.incrementUsage('maps');

      if ((data as any).status === 'OK' && (data as any).results && (data as any).results.length > 0) {
        const location = (data as any).results[0].geometry.location;
        return {
          lat: location.lat,
          lng: location.lng
        };
      }

      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to get address
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    try {
      if (!this.checkUsageLimit('maps')) {
        throw new Error('Google Maps API daily limit exceeded');
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${this.mapsApiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      this.incrementUsage('maps');

      if ((data as any).status === 'OK' && (data as any).results && (data as any).results.length > 0) {
        // Get the first result (most accurate)
        const result = (data as any).results[0];
        return result.formatted_address;
      }

      return null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }

}

// Rate limiting disabled for Cloud Run compatibility
// TODO: Implement proper rate limiting with Cloud Run proxy support
export const googleApiLimiter = (req: any, res: any, next: any) => next();

// Singleton instance
export const googleApiService = new GoogleApiService();

// Export the class for testing
export { GoogleApiService };
