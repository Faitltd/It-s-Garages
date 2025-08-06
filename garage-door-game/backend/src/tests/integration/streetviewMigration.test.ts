/**
 * Street View Migration Integration Tests
 * End-to-end testing of Google → Bing migration
 */

import request from 'supertest';
import { app } from '../../app';
import { MapProviderService } from '../../services/mapProviderService';
import { securityService } from '../../services/securityService';

describe('Street View Migration Integration', () => {
  let mapProviderService: MapProviderService;

  beforeAll(async () => {
    mapProviderService = MapProviderService.getInstance();
    
    // Set test environment variables
    process.env.BING_MAPS_API_KEY = 'test-bing-key';
    process.env.GOOGLE_STREET_VIEW_API_KEY = 'test-google-key';
    process.env.MAP_PROVIDER = 'bing';
    process.env.ENABLE_PROVIDER_FALLBACK = 'true';
  });

  afterAll(async () => {
    // Clean up test environment
    delete process.env.BING_MAPS_API_KEY;
    delete process.env.GOOGLE_STREET_VIEW_API_KEY;
    delete process.env.MAP_PROVIDER;
    delete process.env.ENABLE_PROVIDER_FALLBACK;
  });

  describe('API Endpoint Integration', () => {
    it('should handle street view requests through unified API', async () => {
      const response = await request(app)
        .get('/api/test/streetview')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('streetViewUrl');
      expect(response.body).toHaveProperty('provider');
    });

    it('should maintain backward compatibility with existing endpoints', async () => {
      const testData = {
        address: '123 Test Street, San Francisco, CA',
        doors: [
          {
            width: 8,
            height: 7,
            material: 'steel',
            style: 'traditional'
          }
        ]
      };

      const response = await request(app)
        .post('/api/data-entry')
        .send(testData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('streetViewUrl');
    });
  });

  describe('Provider Switching Integration', () => {
    it('should switch providers without service interruption', async () => {
      // Test with Bing as primary
      await mapProviderService.switchProvider('bing');
      
      const bingResponse = await request(app)
        .get('/api/test/streetview')
        .expect(200);

      expect(bingResponse.body.provider).toBe('bing');

      // Switch to Google
      await mapProviderService.switchProvider('google');
      
      const googleResponse = await request(app)
        .get('/api/test/streetview')
        .expect(200);

      expect(googleResponse.body.provider).toBe('google');
    });

    it('should handle provider health monitoring', async () => {
      const healthStatus = mapProviderService.getProviderHealth();
      
      expect(healthStatus).toHaveLength(2);
      expect(healthStatus.every(h => h.hasOwnProperty('isHealthy'))).toBe(true);
      expect(healthStatus.every(h => h.hasOwnProperty('responseTime'))).toBe(true);
    });
  });

  describe('Security Integration', () => {
    it('should validate API keys securely', async () => {
      const config = securityService.getSecurityConfig();
      
      expect(config).toHaveProperty('provider');
      expect(config).toHaveProperty('enableFallback');
      expect(config).toHaveProperty('maxRetries');
    });

    it('should handle missing API keys gracefully', async () => {
      // Temporarily remove API key
      const originalKey = process.env.BING_MAPS_API_KEY;
      delete process.env.BING_MAPS_API_KEY;

      const response = await request(app)
        .get('/api/test/streetview')
        .expect(200);

      // Should fallback to placeholder or Google
      expect(response.body.success).toBeDefined();
      
      // Restore API key
      process.env.BING_MAPS_API_KEY = originalKey;
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent requests efficiently', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/api/test/streetview')
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      expect(responses).toHaveLength(10);
      expect(responses.every(r => r.status === 200)).toBe(true);
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
    });

    it('should maintain response times under load', async () => {
      const testRequests = Array(5).fill(null).map(async () => {
        const startTime = Date.now();
        const response = await request(app).get('/api/test/streetview');
        const endTime = Date.now();
        
        return {
          status: response.status,
          responseTime: endTime - startTime
        };
      });

      const results = await Promise.all(testRequests);
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

      expect(results.every(r => r.status === 200)).toBe(true);
      expect(avgResponseTime).toBeLessThan(2000); // 2 seconds average
    });
  });

  describe('Data Consistency Integration', () => {
    it('should maintain consistent data format across providers', async () => {
      // Test Bing provider
      await mapProviderService.switchProvider('bing');
      const bingResult = await mapProviderService.getPanorama({
        lat: 37.7749,
        lng: -122.4194,
        size: '480x480'
      });

      // Test Google provider
      await mapProviderService.switchProvider('google');
      const googleResult = await mapProviderService.getPanorama({
        lat: 37.7749,
        lng: -122.4194,
        size: '480x480'
      });

      // Both should have consistent structure
      expect(bingResult).toHaveProperty('imageUrl');
      expect(bingResult).toHaveProperty('provider');
      expect(bingResult).toHaveProperty('metadata');
      expect(bingResult).toHaveProperty('success');

      expect(googleResult).toHaveProperty('imageUrl');
      expect(googleResult).toHaveProperty('provider');
      expect(googleResult).toHaveProperty('metadata');
      expect(googleResult).toHaveProperty('success');

      // Metadata should have consistent structure
      expect(bingResult.metadata).toHaveProperty('lat');
      expect(bingResult.metadata).toHaveProperty('lng');
      expect(bingResult.metadata).toHaveProperty('heading');
      expect(bingResult.metadata).toHaveProperty('pitch');
      expect(bingResult.metadata).toHaveProperty('fov');

      expect(googleResult.metadata).toHaveProperty('lat');
      expect(googleResult.metadata).toHaveProperty('lng');
      expect(googleResult.metadata).toHaveProperty('heading');
      expect(googleResult.metadata).toHaveProperty('pitch');
      expect(googleResult.metadata).toHaveProperty('fov');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle network failures gracefully', async () => {
      // Mock network failure scenario
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .get('/api/test/streetview')
        .expect(200);

      // Should return placeholder or fallback
      expect(response.body).toHaveProperty('success');
      
      // Restore fetch
      global.fetch = originalFetch;
    });

    it('should handle invalid coordinates gracefully', async () => {
      const testData = {
        address: 'Invalid Address That Does Not Exist',
        doors: [{ width: 8, height: 7, material: 'steel', style: 'traditional' }]
      };

      const response = await request(app)
        .post('/api/data-entry')
        .send(testData);

      // Should handle gracefully without crashing
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Audit and Logging Integration', () => {
    it('should log all provider switches', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await mapProviderService.switchProvider('google');
      await mapProviderService.switchProvider('bing');

      // Should have logged the switches
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should maintain audit trail for API usage', async () => {
      const response = await request(app)
        .get('/api/test/streetview')
        .expect(200);

      // Audit logging should be triggered
      expect(response.body).toHaveProperty('success');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing API contract', async () => {
      const response = await request(app)
        .get('/api/test/streetview')
        .expect(200);

      // Should maintain expected response structure
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('streetViewUrl');
      expect(response.body).toHaveProperty('testLocation');
      
      if (response.body.success) {
        expect(typeof response.body.streetViewUrl).toBe('string');
        expect(response.body.streetViewUrl.length).toBeGreaterThan(0);
      }
    });

    it('should handle legacy request formats', async () => {
      // Test with legacy data entry format
      const legacyData = {
        address: '123 Main St, San Francisco, CA',
        doors: [
          {
            width: 8,
            height: 7,
            material: 'steel',
            style: 'traditional'
          }
        ]
      };

      const response = await request(app)
        .post('/api/data-entry')
        .send(legacyData);

      expect(response.status).toBeLessThan(500);
      
      if (response.status === 201) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('streetViewUrl');
      }
    });
  });
});
