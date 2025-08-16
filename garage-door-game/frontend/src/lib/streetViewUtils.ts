/**
 * Street View utilities for optimal garage door viewing
 */

/**
 * Calculate bearing between two geographic points
 * @param lat1 Start latitude
 * @param lng1 Start longitude  
 * @param lat2 End latitude
 * @param lng2 End longitude
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Calculate optimal heading for residential garage door viewing
 * @param streetBearing The bearing/angle of the street
 * @param side 'right' or 'left' side of street
 * @returns Optimal heading in degrees
 */
export function calculateOptimalHeading(streetBearing: number, side: 'right' | 'left' = 'right'): number {
  // Add 90 degrees to face right side houses, 270 degrees for left side houses
  const headingOffset = side === 'right' ? 90 : 270;
  return (streetBearing + headingOffset) % 360;
}

/**
 * Generate Street View URL with optimal heading for garage door viewing
 * @param lat Latitude
 * @param lng Longitude
 * @param apiKey Google Street View API key
 * @param options Additional options
 * @returns Street View URL
 */
export function getOptimalStreetViewUrl(
  lat: number, 
  lng: number, 
  apiKey: string,
  options: {
    size?: string;
    streetBearing?: number;
    side?: 'right' | 'left';
    pitch?: number;
    fov?: number;
  } = {}
): string {
  const {
    size = '600x400',
    streetBearing,
    side = 'right',
    pitch = 10, // Slightly upward to capture house fronts
    fov = 90
  } = options;

  let heading: number;
  
  if (streetBearing !== undefined) {
    // Use provided street bearing to calculate optimal heading
    heading = calculateOptimalHeading(streetBearing, side);
  } else {
    // Fallback to common residential orientations
    const fallbackHeadings = {
      right: [45, 135, 225, 315], // NE, SE, SW, NW
      left: [315, 225, 135, 45]   // NW, SW, SE, NE
    };
    const headings = fallbackHeadings[side];
    heading = headings[Math.floor(Math.random() * headings.length)];
  }

  const params = new URLSearchParams({
    size,
    location: `${lat},${lng}`,
    heading: heading.toString(),
    pitch: pitch.toString(),
    fov: fov.toString(),
    key: apiKey
  });

  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

/**
 * Get multiple Street View URLs with different headings for comprehensive coverage
 * @param lat Latitude
 * @param lng Longitude
 * @param apiKey Google Street View API key
 * @param streetBearing Optional street bearing for optimal calculation
 * @returns Array of Street View URLs covering different angles
 */
export function getMultiAngleStreetViewUrls(
  lat: number,
  lng: number,
  apiKey: string,
  streetBearing?: number
): Array<{ url: string; side: 'right' | 'left'; heading: number }> {
  const sides: Array<'right' | 'left'> = ['right', 'left'];
  const urls: Array<{ url: string; side: 'right' | 'left'; heading: number }> = [];

  sides.forEach(side => {
    let heading: number;
    
    if (streetBearing !== undefined) {
      heading = calculateOptimalHeading(streetBearing, side);
    } else {
      // Use default residential headings
      heading = side === 'right' ? 45 : 315;
    }

    const url = getOptimalStreetViewUrl(lat, lng, apiKey, {
      streetBearing,
      side,
      pitch: 10,
      fov: 90
    });

    urls.push({ url, side, heading });
  });

  return urls;
}

/**
 * Validate Street View API key format
 * @param apiKey API key to validate
 * @returns True if valid format
 */
export function validateApiKey(apiKey: string): boolean {
  // Google API keys are typically 39 characters long and start with 'AIza'
  return apiKey.length === 39 && apiKey.startsWith('AIza');
}

/**
 * Example usage in Svelte component:
 * 
 * ```typescript
 * import { getOptimalStreetViewUrl, calculateBearing } from '$lib/streetViewUtils';
 * 
 * // Basic usage with fallback heading
 * const streetViewUrl = getOptimalStreetViewUrl(lat, lng, apiKey, {
 *   side: 'right',
 *   pitch: 10,
 *   fov: 90
 * });
 * 
 * // Advanced usage with calculated street bearing
 * const streetBearing = calculateBearing(lat1, lng1, lat2, lng2);
 * const optimizedUrl = getOptimalStreetViewUrl(lat, lng, apiKey, {
 *   streetBearing,
 *   side: 'right'
 * });
 * ```
 */
