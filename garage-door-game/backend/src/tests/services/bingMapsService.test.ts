/**
 * Bing Maps Service Test Suite
 * Comprehensive testing with 100% coverage mandate
 */

import { BingMapsService } from '../../services/bingMapsService';
import { securityService } from '../../services/securityService';
import { auditLogger } from '../../services/auditLogger';
import axios from 'axios';

// Mock dependencies
jest.mock('../../services/securityService');
jest.mock('../../services/auditLogger');
jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedSecurityService = securityService as jest.Mocked<typeof securityService>;
const mockedAuditLogger = auditLogger as any;

describe('BingMapsService', () => {
  let bingMapsService: BingMapsService;
  const mockApiKey = 'test-bing-api-key-12345';

  beforeEach(() => {
    jest.clearAllMocks();
    bingMapsService = BingMapsService.getInstance();
    
    // Setup default mocks
    mockedSecurityService.getSecureApiKey.mockResolvedValue(mockApiKey);
    mockedAuditLogger.logApiUsage = jest.fn().mockResolvedValue(undefined);
    mockedAuditLogger.logSecurityEvent = jest.fn().mockResolvedValue(undefined);
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = BingMapsService.getInstance();
      const instance2 = BingMapsService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getStreetViewUrl', () => {
    const validRequest = {
      lat: 37.7749,
      lng: -122.4194,
      size: '480x480',
      heading: 45,
      pitch: -10,
      fov: 90
    };

    const mockMetadataResponse = {
      statusCode: 200,
      statusDescription: 'OK',
      resourceSets: [{
        resources: [{
          imageUrl: 'https://t{subdomain}.ssl.ak.tiles.virtualearth.net/tiles/hs{faceId}{tileId}?g=1&key={key}',
          imageUrlSubdomains: ['0', '1', '2', '3'],
          orientation: 180,
          lat: 37.7749,
          lng: -122.4194
        }]
      }]
    };

    it('should successfully get street view URL with valid request', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockMetadataResponse });

      const result = await bingMapsService.getStreetViewUrl(validRequest);

      expect(result.success).toBe(true);
      expect(result.imageUrl).toContain('tiles.virtualearth.net');
      expect(result.metadata.calculatedBearing).toBe(45);
      expect(result.metadata.fov).toBe(90);
      expect(result.metadata.pitch).toBe(-10);
    });

    it('should use default values when optional parameters are missing', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockMetadataResponse });

      const minimalRequest = {
        lat: 37.7749,
        lng: -122.4194
      };

      const result = await bingMapsService.getStreetViewUrl(minimalRequest);

      expect(result.success).toBe(true);
      expect(result.metadata.fov).toBe(90);
      expect(result.metadata.pitch).toBe(-10);
    });

    it('should handle no streetside imagery available', async () => {
      const emptyResponse = {
        statusCode: 200,
        statusDescription: 'OK',
        resourceSets: []
      };
      
      mockedAxios.get.mockResolvedValueOnce({ data: emptyResponse });

      const result = await bingMapsService.getStreetViewUrl(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No Streetside imagery available');
      expect(result.imageUrl).toContain('placeholder.com');
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await bingMapsService.getStreetViewUrl(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.imageUrl).toContain('placeholder.com');
    });

    it('should log API usage on success', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockMetadataResponse });

      await bingMapsService.getStreetViewUrl(validRequest);

      expect(mockedAuditLogger.logApiUsage).toHaveBeenCalledWith({
        provider: 'bing',
        keyType: 'streetside',
        usageCount: 1,
        responseTime: expect.any(Number),
        cached: false
      });
    });

    it('should log security events on error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      await bingMapsService.getStreetViewUrl(validRequest);

      expect(mockedAuditLogger.logSecurityEvent).toHaveBeenCalledWith({
        event: 'BING_STREETSIDE_ERROR',
        provider: 'bing',
        severity: 'MEDIUM',
        timestamp: expect.any(Date),
        details: expect.objectContaining({
          error: 'API Error',
          responseTime: expect.any(Number)
        })
      });
    });
  });

  describe('getStreetsideMetadata', () => {
    const testLat = 37.7749;
    const testLng = -122.4194;

    it('should successfully fetch metadata', async () => {
      const mockResponse = {
        statusCode: 200,
        statusDescription: 'OK',
        resourceSets: [{ resources: [{}] }]
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await bingMapsService.getStreetsideMetadata(testLat, testLng);

      expect(result).toEqual(mockResponse);
      expect(mockedSecurityService.getSecureApiKey).toHaveBeenCalledWith('bing', 'streetside');
    });

    it('should handle API errors', async () => {
      const errorResponse = {
        statusCode: 404,
        statusDescription: 'Not Found'
      };

      mockedAxios.get.mockResolvedValueOnce({ data: errorResponse });

      const result = await bingMapsService.getStreetsideMetadata(testLat, testLng);

      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await bingMapsService.getStreetsideMetadata(testLat, testLng);

      expect(result).toBeNull();
    });
  });

  describe('calculateBearing', () => {
    it('should calculate bearing using geodesy library', () => {
      const result = bingMapsService.calculateBearing(37.7749, -122.4194, 37.7849, -122.4094);

      expect(result.bearing).toBeGreaterThanOrEqual(0);
      expect(result.bearing).toBeLessThan(360);
      expect(result.distance).toBeGreaterThan(0);
      expect(result.method).toBe('geodesy');
    });

    it('should fallback to haversine on geodesy error', () => {
      // Mock geodesy to throw error
      jest.doMock('geodesy', () => {
        throw new Error('Geodesy error');
      });

      const result = bingMapsService.calculateBearing(37.7749, -122.4194, 37.7849, -122.4094);

      expect(result.method).toBe('haversine');
      expect(result.bearing).toBeGreaterThanOrEqual(0);
      expect(result.bearing).toBeLessThan(360);
    });

    it('should handle same point coordinates', () => {
      const result = bingMapsService.calculateBearing(37.7749, -122.4194, 37.7749, -122.4194);

      expect(result.distance).toBe(0);
      expect(result.bearing).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Tests', () => {
    it('should complete street view request within timeout', async () => {
      const mockResponse = {
        statusCode: 200,
        resourceSets: [{ resources: [{ imageUrl: 'test', imageUrlSubdomains: ['0'] }] }]
      };
      
      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const startTime = Date.now();
      await bingMapsService.getStreetViewUrl({
        lat: 37.7749,
        lng: -122.4194
      });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // 5 second timeout
    });

    it('should handle concurrent requests efficiently', async () => {
      const mockResponse = {
        statusCode: 200,
        resourceSets: [{ resources: [{ imageUrl: 'test', imageUrlSubdomains: ['0'] }] }]
      };
      
      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      const requests = Array(10).fill(null).map(() => 
        bingMapsService.getStreetViewUrl({
          lat: 37.7749 + Math.random() * 0.01,
          lng: -122.4194 + Math.random() * 0.01
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(requests);
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds for 10 concurrent requests
    });
  });

  describe('Security Tests', () => {
    it('should sanitize request data in logs', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Test error'));

      await bingMapsService.getStreetViewUrl({
        lat: 37.7749,
        lng: -122.4194,
        size: '480x480'
      });

      expect(mockedAuditLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            request: {
              lat: 37.7749,
              lng: -122.4194,
              size: '480x480',
              heading: undefined,
              pitch: undefined,
              fov: undefined
            }
          })
        })
      );
    });

    it('should handle API key retrieval errors', async () => {
      mockedSecurityService.getSecureApiKey.mockRejectedValueOnce(new Error('API key error'));

      const result = await bingMapsService.getStreetsideMetadata(37.7749, -122.4194);

      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid coordinates', async () => {
      const result = await bingMapsService.getStreetViewUrl({
        lat: 999,
        lng: 999
      });

      expect(result.success).toBe(false);
    });

    it('should handle malformed API responses', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: null });

      const result = await bingMapsService.getStreetViewUrl({
        lat: 37.7749,
        lng: -122.4194
      });

      expect(result.success).toBe(false);
    });

    it('should handle timeout errors', async () => {
      mockedAxios.get.mockRejectedValueOnce({ code: 'ECONNABORTED' });

      const result = await bingMapsService.getStreetViewUrl({
        lat: 37.7749,
        lng: -122.4194
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle retry logic on transient errors', async () => {
      // First call fails, second succeeds
      mockedAxios.get
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockResolvedValueOnce({
          data: {
            statusCode: 200,
            resourceSets: [{ resources: [{ imageUrl: 'test', imageUrlSubdomains: ['0'] }] }]
          }
        });

      const result = await bingMapsService.getStreetsideMetadata(37.7749, -122.4194);

      expect(result).toBeDefined();
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });
});
