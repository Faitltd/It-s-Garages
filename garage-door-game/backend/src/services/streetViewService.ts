import axios from 'axios';
import * as turf from '@turf/turf';
import { googleApiService } from './googleApiService';

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const METADATA_URL = 'https://maps.googleapis.com/maps/api/streetview/metadata';
const STREETVIEW_URL = 'https://maps.googleapis.com/maps/api/streetview';
const OVERPASS_URL = process.env.OVERPASS_API_URL!;

interface GeocodeResult {
  lat: number;
  lng: number;
  formatted_address: string;
  types: string[];
}

interface StreetViewMetadata {
  panoId: string;
  location: {
    lat: number;
    lng: number;
  };
  status: string;
}

interface StreetViewOptions {
  size?: string;
  heading?: number;
  pitch?: number;
  fov?: number;
}

export class StreetViewService {
  
  /**
   * Geocode address to lat/lng, filtering for residential addresses only
   */
  async geocode(address: string): Promise<GeocodeResult> {
    try {
      const apiKey = googleApiService.getMapsApiKey();
      const response = await axios.get(GEOCODE_URL, {
        params: {
          address,
          key: apiKey
        }
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        throw new Error(`Geocoding failed: ${response.data.status}`);
      }

      // Filter for residential addresses only
      const result = response.data.results.find((r: any) =>
        r.types.includes('street_address') &&
        (r.types.includes('subpremise') ||
         r.types.includes('premise')) &&
        !r.types.includes('establishment') &&
        !r.types.includes('point_of_interest')
      );

      if (!result) throw new Error('Not a residential address');

      // Additional check for residential components
      const hasResidential = result.address_components.some((comp: any) =>
        comp.types.includes('street_number') ||
        comp.types.includes('route')
      );

      if (!hasResidential) throw new Error('Not a home address');

      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formatted_address: result.formatted_address,
        types: result.types
      };
    } catch (error) {
      console.error('Geocoding error:', error);
      throw error;
    }
  }

  /**
   * Fetch residential building footprint from OpenStreetMap via Overpass API
   */
  async fetchBuildingFootprint(lat: number, lng: number): Promise<GeoJSON.Feature<GeoJSON.Polygon> | null> {
    try {
      // Enhanced query to find residential buildings only
      const query = `[out:json];
        (
          way["building"~"^(house|detached|residential|apartments|yes)$"](around:20,${lat},${lng});
          way["building"]["building:use"="residential"](around:20,${lat},${lng});
        );
        out geom;`;

      const response = await axios.post(OVERPASS_URL, query, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 10000 // 10 second timeout
      });

      const elements = response.data.elements.filter((el: any) => {
        // Exclude commercial/industrial buildings
        const tags = el.tags || {};
        return !tags.amenity &&
               !tags.shop &&
               !tags.office &&
               !tags.industrial;
      });

      if (!elements || elements.length === 0) {
        return null;
      }

      // Use the first residential building found
      const building = elements[0];
      if (!building.geometry || building.geometry.length < 3) {
        return null;
      }

      // Convert OSM geometry to GeoJSON coordinates
      const coordinates = building.geometry.map((point: any) => [point.lon, point.lat]);

      // Ensure the polygon is closed
      if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
          coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
        coordinates.push(coordinates[0]);
      }

      return turf.polygon([coordinates]);
    } catch (error) {
      console.error('Building footprint fetch error:', error);
      return null;
    }
  }

  /**
   * Validate that the location is in a residential area
   */
  async validateResidential(lat: number, lng: number): Promise<boolean> {
    try {
      // Check for nearby residential indicators
      const query = `[out:json];
        (
          node["amenity"~"^(school|hospital|fire_station|police)$"](around:500,${lat},${lng});
          way["landuse"="residential"](around:200,${lat},${lng});
          node["highway"="residential"](around:100,${lat},${lng});
        );
        out;`;

      const response = await axios.post(OVERPASS_URL, query, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 10000
      });

      // If we find residential landuse or residential streets, likely a home area
      return response.data.elements.length > 0;
    } catch (error) {
      console.error('Residential validation error:', error);
      return false; // Default to false if validation fails
    }
  }

  /**
   * Get Street View metadata for a location
   */
  async fetchStreetViewMetadata(lat: number, lng: number): Promise<StreetViewMetadata> {
    try {
      const apiKey = googleApiService.getStreetViewApiKey();
      const response = await axios.get(METADATA_URL, {
        params: {
          location: `${lat},${lng}`,
          key: apiKey
        }
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Street View not available: ${response.data.status}`);
      }

      return {
        panoId: response.data.pano_id,
        location: response.data.location,
        status: response.data.status
      };
    } catch (error) {
      console.error('Street View metadata error:', error);
      throw new Error('Failed to fetch Street View metadata');
    }
  }

  /**
   * Calculate bearing from Street View camera to building centroid and build URL
   */
  private buildStreetViewUrl(
    panoId: string,
    cameraLocation: GeoJSON.Feature<GeoJSON.Point>,
    buildingCentroid: GeoJSON.Feature<GeoJSON.Point>,
    options: StreetViewOptions = {}
  ): string {
    const bearing = turf.bearing(cameraLocation, buildingCentroid);
    const apiKey = googleApiService.getStreetViewApiKey();

    const params = new URLSearchParams({
      size: options.size || '600x400',
      pano: panoId,
      heading: bearing.toFixed(1),
      pitch: (options.pitch || 0).toString(),
      fov: (options.fov || 90).toString(),
      key: apiKey
    });

    return `${STREETVIEW_URL}?${params.toString()}`;
  }

  /**
   * Main orchestrator: Get optimized Street View image URL for a residential address
   * This method combines geocoding, residential validation, building footprint detection,
   * and bearing calculation to provide a Street View image that faces the front of the house
   */
  async getHomeStreetViewUrl(address: string, options: StreetViewOptions = {}): Promise<{
    url: string;
    metadata: {
      address: string;
      coordinates: { lat: number; lng: number };
      buildingFound: boolean;
      isResidential: boolean;
      bearing?: number;
    }
  }> {
    try {
      // Step 1: Geocode the address
      const geocodeResult = await this.geocode(address);

      // Step 2: Validate it's in a residential area
      const isResidential = await this.validateResidential(geocodeResult.lat, geocodeResult.lng);
      if (!isResidential) {
        throw new Error('Address does not appear to be in a residential area');
      }

      // Step 3: Try to fetch residential building footprint
      const buildingFootprint = await this.fetchBuildingFootprint(
        geocodeResult.lat,
        geocodeResult.lng
      );

      if (!buildingFootprint) {
        throw new Error('Residential building footprint not found');
      }

      // Step 4: Get Street View metadata
      const streetViewMeta = await this.fetchStreetViewMetadata(
        geocodeResult.lat,
        geocodeResult.lng
      );

      let streetViewUrl: string;
      let bearing: number | undefined;

      // We found a building footprint - calculate optimal bearing
      const buildingCentroid = turf.centroid(buildingFootprint);
      const cameraLocation = turf.point([
        streetViewMeta.location.lng,
        streetViewMeta.location.lat
      ]);

      bearing = turf.bearing(cameraLocation, buildingCentroid);
      streetViewUrl = this.buildStreetViewUrl(
        streetViewMeta.panoId,
        cameraLocation,
        buildingCentroid,
        options
      );

      return {
        url: streetViewUrl,
        metadata: {
          address: geocodeResult.formatted_address,
          coordinates: {
            lat: geocodeResult.lat,
            lng: geocodeResult.lng
          },
          buildingFound: true,
          isResidential: true,
          bearing
        }
      };

    } catch (error) {
      console.error('Street View service error:', error);
      throw error;
    }
  }

  /**
   * Flexible version that provides Street View even if building footprint isn't found
   */
  async getFlexibleHomeStreetView(address: string, options: StreetViewOptions = {}): Promise<{
    url: string;
    metadata: {
      address: string;
      coordinates: { lat: number; lng: number };
      buildingFound: boolean;
      isResidential: boolean;
      bearing?: number;
      fallbackUsed: boolean;
    }
  }> {
    try {
      // Step 1: Geocode the address
      const geocodeResult = await this.geocode(address);

      // Step 2: Validate it's in a residential area (but don't fail if not)
      const isResidential = await this.validateResidential(geocodeResult.lat, geocodeResult.lng);

      // Step 3: Try to fetch residential building footprint
      const buildingFootprint = await this.fetchBuildingFootprint(
        geocodeResult.lat,
        geocodeResult.lng
      );

      // Step 4: Get Street View metadata
      const streetViewMeta = await this.fetchStreetViewMetadata(
        geocodeResult.lat,
        geocodeResult.lng
      );

      let streetViewUrl: string;
      let bearing: number | undefined;
      let fallbackUsed = false;

      if (buildingFootprint) {
        // We found a building footprint - calculate optimal bearing
        const buildingCentroid = turf.centroid(buildingFootprint);
        const cameraLocation = turf.point([
          streetViewMeta.location.lng,
          streetViewMeta.location.lat
        ]);

        bearing = turf.bearing(cameraLocation, buildingCentroid);
        streetViewUrl = this.buildStreetViewUrl(
          streetViewMeta.panoId,
          cameraLocation,
          buildingCentroid,
          options
        );
      } else {
        // No building footprint found - use default Street View
        fallbackUsed = true;
        const streetViewParams: any = {
          lat: geocodeResult.lat,
          lng: geocodeResult.lng,
          size: options.size || '600x400',
          pitch: options.pitch || 0,
          fov: options.fov || 90
        };

        if (options.heading !== undefined) {
          streetViewParams.heading = options.heading;
        }

        streetViewUrl = googleApiService.buildStreetViewUrl(streetViewParams);
      }

      const metadata: any = {
        address: geocodeResult.formatted_address,
        coordinates: {
          lat: geocodeResult.lat,
          lng: geocodeResult.lng
        },
        buildingFound: !!buildingFootprint,
        isResidential,
        fallbackUsed
      };

      if (bearing !== undefined) {
        metadata.bearing = bearing;
      }

      return {
        url: streetViewUrl,
        metadata
      };

    } catch (error) {
      console.error('Flexible Street View service error:', error);
      throw error;
    }
  }

  /**
   * Get multiple Street View angles for a single address
   */
  async getMultiAngleStreetView(address: string, angles: number[] = [0, 90, 180, 270]): Promise<{
    address: string;
    coordinates: { lat: number; lng: number };
    images: Array<{ angle: number; url: string }>;
  }> {
    const geocodeResult = await this.geocode(address);

    const images = angles.map(angle => ({
      angle,
      url: googleApiService.buildStreetViewUrl({
        lat: geocodeResult.lat,
        lng: geocodeResult.lng,
        heading: angle,
        size: '400x300',
        pitch: 0,
        fov: 90
      })
    }));

    return {
      address: geocodeResult.formatted_address,
      coordinates: {
        lat: geocodeResult.lat,
        lng: geocodeResult.lng
      },
      images
    };
  }
}

// Export singleton instance
export const streetViewService = new StreetViewService();
