/**
 * Map Provider Service Test Suite
 * Testing unified provider abstraction and failover mechanisms
 */

import { MapProviderService } from '../../services/mapProviderService';
import { GoogleApiService } from '../../services/googleApiService';
import { BingMapsService } from '../../services/bingMapsService';
import { securityService } from '../../services/securityService';
import { auditLogger } from '../../services/auditLogger';

// Mock dependencies
jest.mock('../../services/googleApiService');
jest.mock('../../services/bingMapsService');
jest.mock('../../services/securityService');
jest.mock('../../services/auditLogger');

const mockedGoogleService = GoogleApiService as any;
const mockedBingService = BingMapsService as any;
const mockedSecurityService = securityService as jest.Mocked<typeof securityService>;
const mockedAuditLogger = auditLogger as any;

describe('MapProviderService', () => {
  let mapProviderService: MapProviderService;
  let mockGoogleInstance: jest.Mocked<GoogleApiService>;
  let mockBingInstance: jest.Mocked<BingMapsService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock instances
    mockGoogleInstance = {
      buildStreetViewUrl: jest.fn()
    } as any;
    
    mockBingInstance = {
      getStreetViewUrl: jest.fn()
    } as any;

    mockedGoogleService.mockImplementation(() => mockGoogleInstance);
    mockedBingService.getInstance = jest.fn().mockReturnValue(mockBingInstance);
    
    // Setup security service mocks
    mockedSecurityService.getSecurityConfig.mockReturnValue({
      provider: 'bing',
      enableFallback: true,
      maxRetries: 3,
      auditLevel: 'detailed'
    });

    mockedAuditLogger.logApiUsage = jest.fn().mockResolvedValue(undefined);
    mockedAuditLogger.logSecurityEvent = jest.fn().mockResolvedValue(undefined);

    mapProviderService = MapProviderService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MapProviderService.getInstance();
      const instance2 = MapProviderService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  const validRequest = {
    lat: 37.7749,
    lng: -122.4194,
    size: '480x480',
    heading: 45,
    pitch: -10,
    fov: 90
  };

  describe('getPanorama', () => {

    it('should use Bing as primary provider when configured', async () => {
      mockBingInstance.getStreetViewUrl.mockResolvedValueOnce({
        imageUrl: 'https://bing-streetside-url.com/image.jpg',
        metadata: {
          originalBearing: 0,
          calculatedBearing: 45,
          distance: 100,
          fov: 90,
          pitch: -10
        },
        success: true
      });

      const result = await mapProviderService.getPanorama(validRequest);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('bing');
      expect(result.imageUrl).toContain('bing-streetside-url.com');
      expect(mockBingInstance.getStreetViewUrl).toHaveBeenCalledWith(validRequest);
    });

    it('should fallback to Google when Bing fails', async () => {
      // Bing fails
      mockBingInstance.getStreetViewUrl.mockResolvedValueOnce({
        imageUrl: '',
        metadata: {
          originalBearing: 0,
          calculatedBearing: 0,
          distance: 0,
          fov: 90,
          pitch: -10
        },
        success: false,
        error: 'Bing service unavailable'
      });

      // Google succeeds
      mockGoogleInstance.buildStreetViewUrl.mockReturnValueOnce(
        'https://maps.googleapis.com/maps/api/streetview?location=37.7749,-122.4194'
      );

      const result = await mapProviderService.getPanorama(validRequest);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('google');
      expect(result.imageUrl).toContain('googleapis.com');
      expect(mockBingInstance.getStreetViewUrl).toHaveBeenCalled();
      expect(mockGoogleInstance.buildStreetViewUrl).toHaveBeenCalled();
    });

    it('should log fallback events', async () => {
      mockBingInstance.getStreetViewUrl.mockResolvedValueOnce({
        imageUrl: '',
        metadata: {
          originalBearing: 0,
          calculatedBearing: 0,
          distance: 0,
          fov: 90,
          pitch: -10
        },
        success: false,
        error: 'Service error'
      });

      mockGoogleInstance.buildStreetViewUrl.mockReturnValueOnce('google-url');

      await mapProviderService.getPanorama(validRequest);

      expect(mockedAuditLogger.logSecurityEvent).toHaveBeenCalledWith({
        event: 'PROVIDER_FALLBACK',
        provider: 'bing',
        severity: 'MEDIUM',
        timestamp: expect.any(Date),
        details: expect.objectContaining({
          primaryProvider: 'bing',
          fallbackProvider: 'google',
          error: 'Service error'
        })
      });
    });

    it('should handle provider preference in request', async () => {
      const googleRequest = { ...validRequest, provider: 'google' as const };
      
      mockGoogleInstance.buildStreetViewUrl.mockReturnValueOnce('google-url');

      const result = await mapProviderService.getPanorama(googleRequest);

      expect(result.provider).toBe('google');
      expect(mockGoogleInstance.buildStreetViewUrl).toHaveBeenCalled();
      expect(mockBingInstance.getStreetViewUrl).not.toHaveBeenCalled();
    });

    it('should return placeholder on complete failure', async () => {
      mockBingInstance.getStreetViewUrl.mockResolvedValueOnce({
        imageUrl: '',
        metadata: {
          originalBearing: 0,
          calculatedBearing: 0,
          distance: 0,
          fov: 90,
          pitch: -10
        },
        success: false,
        error: 'Bing failed'
      });

      mockGoogleInstance.buildStreetViewUrl.mockImplementationOnce(() => {
        throw new Error('Google failed');
      });

      const result = await mapProviderService.getPanorama(validRequest);

      expect(result.success).toBe(false);
      expect(result.imageUrl).toContain('placeholder.com');
      expect(result.error).toBeDefined();
    });
  });

  describe('Provider Health Monitoring', () => {
    it('should track provider health status', () => {
      const healthStatus = mapProviderService.getProviderHealth();

      expect(healthStatus).toHaveLength(2);
      expect(healthStatus.map(h => h.provider)).toContain('google');
      expect(healthStatus.map(h => h.provider)).toContain('bing');
    });

    it('should test provider connectivity', async () => {
      mockBingInstance.getStreetViewUrl.mockResolvedValueOnce({
        imageUrl: 'test-url',
        metadata: {
          originalBearing: 0,
          calculatedBearing: 0,
          distance: 0,
          fov: 90,
          pitch: 0
        },
        success: true
      });

      const isHealthy = await mapProviderService.testProvider('bing');

      expect(isHealthy).toBe(true);
      expect(mockBingInstance.getStreetViewUrl).toHaveBeenCalled();
    });
  });

  describe('Provider Switching', () => {
    it('should allow manual provider switching', async () => {
      await mapProviderService.switchProvider('google');

      expect(mockedAuditLogger.logSecurityEvent).toHaveBeenCalledWith({
        event: 'PROVIDER_SWITCH',
        severity: 'MEDIUM',
        timestamp: expect.any(Date),
        details: expect.objectContaining({
          to: 'google',
          manual: true
        })
      });
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should open circuit breaker after consecutive failures', async () => {
      // Simulate 5 consecutive failures
      for (let i = 0; i < 5; i++) {
        mockBingInstance.getStreetViewUrl.mockResolvedValueOnce({
          imageUrl: '',
          metadata: {
            originalBearing: 0,
            calculatedBearing: 0,
            distance: 0,
            fov: 90,
            pitch: -10
          },
          success: false,
          error: 'Service error'
        });

        mockGoogleInstance.buildStreetViewUrl.mockReturnValueOnce('fallback-url');

        await mapProviderService.getPanorama(validRequest);
      }

      // Next request should skip Bing due to circuit breaker
      mockGoogleInstance.buildStreetViewUrl.mockReturnValueOnce('direct-google-url');

      const result = await mapProviderService.getPanorama({ ...validRequest, provider: 'auto' });

      expect(result.provider).toBe('google');
    });
  });

  describe('Performance Tests', () => {
    it('should complete requests within acceptable time', async () => {
      mockBingInstance.getStreetViewUrl.mockResolvedValueOnce({
        imageUrl: 'test-url',
        metadata: {
          originalBearing: 0,
          calculatedBearing: 45,
          distance: 100,
          fov: 90,
          pitch: -10
        },
        success: true
      });

      const startTime = Date.now();
      await mapProviderService.getPanorama(validRequest);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000); // 2 seconds
    });

    it('should handle concurrent requests efficiently', async () => {
      mockBingInstance.getStreetViewUrl.mockResolvedValue({
        imageUrl: 'test-url',
        metadata: {
          originalBearing: 0,
          calculatedBearing: 45,
          distance: 100,
          fov: 90,
          pitch: -10
        },
        success: true
      });

      const requests = Array(20).fill(null).map((_, i) => 
        mapProviderService.getPanorama({
          ...validRequest,
          lat: validRequest.lat + i * 0.001
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(requests);
      const endTime = Date.now();

      expect(results).toHaveLength(20);
      expect(results.every(r => r.success)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds for 20 requests
    });
  });

  describe('Security and Audit', () => {
    it('should log all API usage', async () => {
      mockBingInstance.getStreetViewUrl.mockResolvedValueOnce({
        imageUrl: 'test-url',
        metadata: {
          originalBearing: 0,
          calculatedBearing: 45,
          distance: 100,
          fov: 90,
          pitch: -10
        },
        success: true
      });

      await mapProviderService.getPanorama(validRequest);

      expect(mockedAuditLogger.logApiUsage).toHaveBeenCalledWith({
        provider: 'bing',
        keyType: 'panorama',
        usageCount: 1,
        responseTime: 0,
        cached: false
      });
    });

    it('should sanitize request data in logs', async () => {
      mockBingInstance.getStreetViewUrl.mockRejectedValueOnce(new Error('Test error'));

      await mapProviderService.getPanorama(validRequest);

      expect(mockedAuditLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'PANORAMA_REQUEST_FAILED',
          details: expect.objectContaining({
            request: {
              lat: validRequest.lat,
              lng: validRequest.lng,
              size: validRequest.size,
              heading: validRequest.heading,
              pitch: validRequest.pitch,
              fov: validRequest.fov,
              provider: undefined
            }
          })
        })
      );
    });
  });
});
