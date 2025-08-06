import { StreetViewService } from '../services/streetViewService';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock the googleApiService
jest.mock('../services/googleApiService', () => ({
  googleApiService: {
    getMapsApiKey: jest.fn(() => 'test-maps-key'),
    getStreetViewApiKey: jest.fn(() => 'test-streetview-key'),
    buildStreetViewUrl: jest.fn((params) => `https://maps.googleapis.com/maps/api/streetview?size=${params.size}&location=${params.lat},${params.lng}&key=test-key`)
  }
}));

describe('StreetViewService', () => {
  let streetViewService: StreetViewService;

  beforeEach(() => {
    streetViewService = new StreetViewService();
    jest.clearAllMocks();
  });

  describe('geocode', () => {
    it('should successfully geocode a residential address', async () => {
      const mockResponse = {
        data: {
          status: 'OK',
          results: [
            {
              geometry: {
                location: { lat: 39.7392, lng: -104.9903 }
              },
              formatted_address: '123 Main St, Denver, CO 80202, USA',
              types: ['street_address', 'premise'],
              address_components: [
                { types: ['street_number'] },
                { types: ['route'] }
              ]
            }
          ]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await streetViewService.geocode('123 Main St, Denver, CO');

      expect(result).toEqual({
        lat: 39.7392,
        lng: -104.9903,
        formatted_address: '123 Main St, Denver, CO 80202, USA',
        types: ['street_address', 'premise']
      });
    });

    it('should reject non-residential addresses', async () => {
      const mockResponse = {
        data: {
          status: 'OK',
          results: [
            {
              geometry: {
                location: { lat: 39.7392, lng: -104.9903 }
              },
              formatted_address: 'Starbucks, Denver, CO',
              types: ['establishment', 'point_of_interest'],
              address_components: []
            }
          ]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      await expect(streetViewService.geocode('Starbucks, Denver, CO'))
        .rejects.toThrow('Not a residential address');
    });
  });

  describe('validateResidential', () => {
    it('should return true for residential areas', async () => {
      const mockResponse = {
        data: {
          elements: [
            { type: 'way', tags: { landuse: 'residential' } }
          ]
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await streetViewService.validateResidential(39.7392, -104.9903);
      expect(result).toBe(true);
    });

    it('should return false for non-residential areas', async () => {
      const mockResponse = {
        data: {
          elements: []
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await streetViewService.validateResidential(39.7392, -104.9903);
      expect(result).toBe(false);
    });
  });

  describe('fetchBuildingFootprint', () => {
    it('should return building footprint for residential buildings', async () => {
      const mockResponse = {
        data: {
          elements: [
            {
              geometry: [
                { lat: 39.7392, lon: -104.9903 },
                { lat: 39.7393, lon: -104.9903 },
                { lat: 39.7393, lon: -104.9904 },
                { lat: 39.7392, lon: -104.9904 }
              ],
              tags: { building: 'house' }
            }
          ]
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await streetViewService.fetchBuildingFootprint(39.7392, -104.9903);
      
      expect(result).toBeTruthy();
      expect(result?.geometry.type).toBe('Polygon');
    });

    it('should filter out commercial buildings', async () => {
      const mockResponse = {
        data: {
          elements: [
            {
              geometry: [
                { lat: 39.7392, lon: -104.9903 },
                { lat: 39.7393, lon: -104.9903 },
                { lat: 39.7393, lon: -104.9904 },
                { lat: 39.7392, lon: -104.9904 }
              ],
              tags: { building: 'yes', shop: 'convenience' }
            }
          ]
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await streetViewService.fetchBuildingFootprint(39.7392, -104.9903);
      expect(result).toBeNull();
    });
  });

  describe('getFlexibleHomeStreetView', () => {
    it('should return street view URL with building footprint', async () => {
      // Mock geocode response
      const geocodeResponse = {
        data: {
          status: 'OK',
          results: [
            {
              geometry: { location: { lat: 39.7392, lng: -104.9903 } },
              formatted_address: '123 Main St, Denver, CO 80202, USA',
              types: ['street_address', 'premise'],
              address_components: [{ types: ['street_number'] }]
            }
          ]
        }
      };

      // Mock residential validation response
      const residentialResponse = {
        data: { elements: [{ type: 'way', tags: { landuse: 'residential' } }] }
      };

      // Mock building footprint response
      const buildingResponse = {
        data: {
          elements: [
            {
              geometry: [
                { lat: 39.7392, lon: -104.9903 },
                { lat: 39.7393, lon: -104.9903 },
                { lat: 39.7393, lon: -104.9904 },
                { lat: 39.7392, lon: -104.9904 }
              ],
              tags: { building: 'house' }
            }
          ]
        }
      };

      // Mock Street View metadata response
      const streetViewResponse = {
        data: {
          status: 'OK',
          pano_id: 'test-pano-id',
          location: { lat: 39.7392, lng: -104.9903 }
        }
      };

      mockedAxios.get
        .mockResolvedValueOnce(geocodeResponse)
        .mockResolvedValueOnce(streetViewResponse);
      
      mockedAxios.post
        .mockResolvedValueOnce(residentialResponse)
        .mockResolvedValueOnce(buildingResponse);

      const result = await streetViewService.getFlexibleHomeStreetView('123 Main St, Denver, CO');

      expect(result.url).toContain('streetview');
      expect(result.metadata.buildingFound).toBe(true);
      expect(result.metadata.isResidential).toBe(true);
      expect(result.metadata.fallbackUsed).toBe(false);
      expect(result.metadata.bearing).toBeDefined();
    });
  });
});
