/**
 * TypeScript interfaces for Bing Maps Streetside API
 * Based on official Bing Maps REST API documentation
 */

export interface BingMapsConfig {
  apiKey: string;
  baseUrl: string;
  maxRetries: number;
  timeout: number;
}

export interface StreetsideMetadataRequest {
  lat: number;
  lng: number;
  includeImageryProviders?: boolean;
  output?: 'json' | 'xml';
  key: string;
}

export interface StreetsideMetadataResponse {
  authenticationResultCode: string;
  brandLogoUri: string;
  copyright: string;
  resourceSets: StreetsideResourceSet[];
  statusCode: number;
  statusDescription: string;
  traceId: string;
}

export interface StreetsideResourceSet {
  estimatedTotal: number;
  resources: StreetsideResource[];
}

export interface StreetsideResource {
  __type: string;
  imageHeight: number;
  imageWidth: number;
  imageUrl: string;
  imageUrlSubdomains: string[];
  imageryProviders?: ImageryProvider[];
  vintageEnd?: string;
  vintageStart?: string;
  zoomMax: number;
  zoomMin: number;
  
  // Streetside specific properties
  orientation?: number;  // Camera bearing in degrees (0=North)
  pitch?: number;       // Camera pitch in degrees
  roll?: number;        // Camera roll in degrees
  lat?: number;         // Panorama latitude
  lng?: number;         // Panorama longitude
  he?: number;          // Height above ellipsoid
  
  // Bubble metadata
  id?: string;          // Unique bubble identifier
  cd?: string;          // Capture date
  ad?: string;          // Acquisition date
}

export interface ImageryProvider {
  attribution: string;
  coverageAreas: CoverageArea[];
}

export interface CoverageArea {
  bbox: number[];
  zoomMax: number;
  zoomMin: number;
}

export interface StreetsideTileRequest {
  subdomain: string;
  faceId: number;      // Cube face (0-5: front, right, back, left, top, bottom)
  tileId: string;      // Tile coordinates in format "level_x_y"
  imageUrl: string;    // Template URL from metadata
}

export interface StreetsideTileResponse {
  imageData: Buffer;
  contentType: string;
  contentLength: number;
  success: boolean;
  error?: string;
}

export interface PanoramaStitchRequest {
  metadata: StreetsideResource;
  targetLat: number;
  targetLng: number;
  fov?: number;        // Field of view in degrees (default: 90)
  pitch?: number;      // Pitch adjustment in degrees (default: 0)
  outputSize?: {       // Output image dimensions
    width: number;
    height: number;
  };
}

export interface PanoramaStitchResponse {
  imageUrl?: string;   // URL to stitched image
  imageData?: Buffer;  // Raw image data
  metadata: {
    originalBearing: number;
    calculatedBearing: number;
    distance: number;  // Distance to target in meters
    fov: number;
    pitch: number;
    size: {
      width: number;
      height: number;
    };
  };
  success: boolean;
  error?: string;
}

export interface BearingCalculation {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  bearing: number;     // Calculated bearing in degrees
  distance: number;    // Distance in meters
  method: 'geodesy' | 'haversine' | 'vincenty';
}

export interface StreetsideError {
  code: string;
  message: string;
  details?: any;
  provider: 'bing';
  timestamp: Date;
}

// Cube face mapping for Streetside panoramas
export enum CubeFace {
  FRONT = 0,   // Forward view
  RIGHT = 1,   // Right view
  BACK = 2,    // Backward view
  LEFT = 3,    // Left view
  TOP = 4,     // Upward view
  BOTTOM = 5   // Downward view
}

// Tile level constants
export interface TileLevel {
  level: number;
  tilesPerFace: number;
  tileSize: number;
  totalPixels: number;
}

export const STREETSIDE_TILE_LEVELS: TileLevel[] = [
  { level: 1, tilesPerFace: 1, tileSize: 256, totalPixels: 256 },
  { level: 2, tilesPerFace: 4, tileSize: 256, totalPixels: 512 },
  { level: 3, tilesPerFace: 16, tileSize: 256, totalPixels: 1024 },
  { level: 4, tilesPerFace: 64, tileSize: 256, totalPixels: 2048 }
];

// Provider abstraction interfaces
export interface MapProvider {
  name: 'google' | 'bing';
  type: 'streetview' | 'streetside';
  isAvailable: boolean;
  lastError?: string;
}

export interface ProviderSwitchConfig {
  primaryProvider: MapProvider;
  fallbackProvider: MapProvider | undefined;
  autoSwitch: boolean;
  maxRetries: number;
  healthCheckInterval: number; // milliseconds
}

export interface UnifiedPanoramaRequest {
  lat: number;
  lng: number;
  size?: string;
  heading?: number;
  pitch?: number;
  fov?: number;
  provider?: 'google' | 'bing' | 'auto';
}

export interface UnifiedPanoramaResponse {
  imageUrl: string;
  provider: 'google' | 'bing';
  metadata: {
    lat: number;
    lng: number;
    heading: number;
    pitch: number;
    fov: number;
    size: string;
    cached: boolean;
    responseTime: number;
  };
  success: boolean;
  error: string | undefined;
}
