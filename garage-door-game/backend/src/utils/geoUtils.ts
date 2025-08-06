/**
 * Geographic Utilities
 * Enhanced bearing calculations and geographic operations
 */

// Using built-in math functions instead of geodesy library for better compatibility
import { BearingCalculation } from '../types/bingMaps';

export interface GeoPoint {
  lat: number;
  lng: number;
  elevation?: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface DistanceResult {
  distance: number;
  bearing: number;
  reverseBearing: number;
  method: 'haversine' | 'vincenty' | 'geodesy';
}

export class GeoUtils {
  
  /**
   * Calculate bearing between two points using multiple methods
   */
  public static calculateBearing(
    from: GeoPoint, 
    to: GeoPoint, 
    method: 'haversine' | 'vincenty' | 'geodesy' = 'geodesy'
  ): BearingCalculation {
    
    try {
      switch (method) {
        case 'geodesy':
          return this.calculateBearingGeodesy(from, to);
        case 'haversine':
          return this.calculateBearingHaversine(from, to);
        case 'vincenty':
          return this.calculateBearingVincenty(from, to);
        default:
          return this.calculateBearingGeodesy(from, to);
      }
    } catch (error) {
      console.error(`Bearing calculation failed with method ${method}:`, error);
      
      // Fallback to simple haversine
      return this.calculateBearingHaversine(from, to);
    }
  }

  /**
   * Calculate bearing using haversine formula (fallback for geodesy)
   */
  private static calculateBearingGeodesy(from: GeoPoint, to: GeoPoint): BearingCalculation {
    // Fallback to haversine when geodesy is not available
    return this.calculateBearingHaversine(from, to);
  }

  /**
   * Calculate bearing using Haversine formula (good for most cases)
   */
  private static calculateBearingHaversine(from: GeoPoint, to: GeoPoint): BearingCalculation {
    const lat1 = this.toRadians(from.lat);
    const lat2 = this.toRadians(to.lat);
    const deltaLng = this.toRadians(to.lng - from.lng);

    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
    
    const bearing = this.toDegrees(Math.atan2(y, x));
    const distance = this.calculateHaversineDistance(from, to);

    return {
      fromLat: from.lat,
      fromLng: from.lng,
      toLat: to.lat,
      toLng: to.lng,
      bearing: this.normalizeBearing(bearing),
      distance,
      method: 'haversine'
    };
  }

  /**
   * Calculate bearing using Vincenty formula (most accurate for long distances)
   */
  private static calculateBearingVincenty(from: GeoPoint, to: GeoPoint): BearingCalculation {
    // Simplified Vincenty implementation
    // For production, consider using a dedicated library
    const lat1 = this.toRadians(from.lat);
    const lat2 = this.toRadians(to.lat);
    const deltaLng = this.toRadians(to.lng - from.lng);

    const a = 6378137; // WGS84 semi-major axis
    const f = 1 / 298.257223563; // WGS84 flattening
    const b = (1 - f) * a;

    const U1 = Math.atan((1 - f) * Math.tan(lat1));
    const U2 = Math.atan((1 - f) * Math.tan(lat2));
    
    const sinU1 = Math.sin(U1);
    const cosU1 = Math.cos(U1);
    const sinU2 = Math.sin(U2);
    const cosU2 = Math.cos(U2);

    let lambda = deltaLng;
    let lambdaP;
    let iterLimit = 100;
    let cosSqAlpha: number = 0;
    let sinSigma: number = 0;
    let cos2SigmaM: number = 0;
    let cosSigma: number = 0;
    let sigma: number = 0;

    do {
      const sinLambda = Math.sin(lambda);
      const cosLambda = Math.cos(lambda);
      
      sinSigma = Math.sqrt(
        (cosU2 * sinLambda) * (cosU2 * sinLambda) +
        (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda)
      );
      
      if (sinSigma === 0) break; // co-incident points
      
      cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
      sigma = Math.atan2(sinSigma, cosSigma);
      
      const sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
      cosSqAlpha = 1 - sinAlpha * sinAlpha;
      cos2SigmaM = cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha;
      
      if (isNaN(cos2SigmaM)) cos2SigmaM = 0; // equatorial line
      
      const C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
      lambdaP = lambda;
      lambda = deltaLng + (1 - C) * f * sinAlpha *
        (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
        
    } while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0);

    if (iterLimit === 0) {
      // Fallback to haversine
      return this.calculateBearingHaversine(from, to);
    }

    const uSq = cosSqAlpha * (a * a - b * b) / (b * b);
    const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
    
    const deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
      B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
      
    const distance = b * A * (sigma - deltaSigma);

    const bearing = Math.atan2(
      cosU2 * Math.sin(lambda),
      cosU1 * sinU2 - sinU1 * cosU2 * Math.cos(lambda)
    );

    return {
      fromLat: from.lat,
      fromLng: from.lng,
      toLat: to.lat,
      toLng: to.lng,
      bearing: this.normalizeBearing(this.toDegrees(bearing)),
      distance,
      method: 'vincenty'
    };
  }

  /**
   * Calculate distance using Haversine formula
   */
  private static calculateHaversineDistance(from: GeoPoint, to: GeoPoint): number {
    const R = 6371000; // Earth's radius in meters
    const lat1 = this.toRadians(from.lat);
    const lat2 = this.toRadians(to.lat);
    const deltaLat = this.toRadians(to.lat - from.lat);
    const deltaLng = this.toRadians(to.lng - from.lng);

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
              
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  /**
   * Calculate destination point given start point, bearing, and distance
   */
  public static calculateDestination(
    start: GeoPoint,
    bearing: number,
    distance: number
  ): GeoPoint {
    const R = 6371000; // Earth's radius in meters
    const lat1 = this.toRadians(start.lat);
    const lng1 = this.toRadians(start.lng);
    const bearingRad = this.toRadians(bearing);

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(distance / R) +
      Math.cos(lat1) * Math.sin(distance / R) * Math.cos(bearingRad)
    );

    const lng2 = lng1 + Math.atan2(
      Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(lat1),
      Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2)
    );

    return {
      lat: this.toDegrees(lat2),
      lng: this.toDegrees(lng2)
    };
  }

  /**
   * Check if a point is within a bounding box
   */
  public static isPointInBounds(point: GeoPoint, bounds: BoundingBox): boolean {
    return point.lat >= bounds.south &&
           point.lat <= bounds.north &&
           point.lng >= bounds.west &&
           point.lng <= bounds.east;
  }

  /**
   * Calculate bounding box for a point with radius
   */
  public static calculateBounds(center: GeoPoint, radiusMeters: number): BoundingBox {
    // Calculate points at cardinal directions
    const north = this.calculateDestination(center, 0, radiusMeters);
    const south = this.calculateDestination(center, 180, radiusMeters);
    const east = this.calculateDestination(center, 90, radiusMeters);
    const west = this.calculateDestination(center, 270, radiusMeters);

    return {
      north: north.lat,
      south: south.lat,
      east: east.lng,
      west: west.lng
    };
  }

  /**
   * Normalize bearing to 0-360 degrees
   */
  public static normalizeBearing(bearing: number): number {
    return ((bearing % 360) + 360) % 360;
  }

  /**
   * Convert degrees to radians
   */
  private static toRadians(degrees: number): number {
    return degrees * Math.PI / 180;
  }

  /**
   * Convert radians to degrees
   */
  private static toDegrees(radians: number): number {
    return radians * 180 / Math.PI;
  }

  /**
   * Format coordinates for display
   */
  public static formatCoordinates(point: GeoPoint, format: 'decimal' | 'dms' = 'decimal'): string {
    if (format === 'dms') {
      // Simple DMS formatting without external library
      const latDms = this.toDMS(point.lat, 'lat');
      const lngDms = this.toDMS(point.lng, 'lng');
      return `${latDms}, ${lngDms}`;
    }

    return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
  }

  /**
   * Convert decimal degrees to DMS format
   */
  private static toDMS(decimal: number, type: 'lat' | 'lng'): string {
    const abs = Math.abs(decimal);
    const degrees = Math.floor(abs);
    const minutes = Math.floor((abs - degrees) * 60);
    const seconds = ((abs - degrees) * 60 - minutes) * 60;

    const direction = type === 'lat'
      ? (decimal >= 0 ? 'N' : 'S')
      : (decimal >= 0 ? 'E' : 'W');

    return `${degrees}°${minutes}'${seconds.toFixed(2)}"${direction}`;
  }

  /**
   * Validate coordinates
   */
  public static isValidCoordinate(point: GeoPoint): boolean {
    return point.lat >= -90 && 
           point.lat <= 90 && 
           point.lng >= -180 && 
           point.lng <= 180 &&
           !isNaN(point.lat) && 
           !isNaN(point.lng);
  }
}

export default GeoUtils;
