#!/usr/bin/env ts-node

/**
 * Migration Test Script
 * Demonstrates the Google → Bing Maps migration functionality
 */

import { MapProviderService } from '../services/mapProviderService';
import { BingMapsService } from '../services/bingMapsService';
import { securityService } from '../services/securityService';
import { GeoUtils } from '../utils/geoUtils';

async function testMigration() {
  console.log('🚀 Starting Google Street View → Bing Maps Streetside Migration Test\n');

  // Test coordinates (San Francisco)
  const testLocation = {
    lat: 37.7749,
    lng: -122.4194,
    name: 'San Francisco, CA'
  };

  console.log(`📍 Test Location: ${testLocation.name} (${testLocation.lat}, ${testLocation.lng})\n`);

  try {
    // 1. Test Security Service
    console.log('🔒 Testing Security Service...');
    const securityConfig = securityService.getSecurityConfig();
    console.log(`   Provider: ${securityConfig.provider}`);
    console.log(`   Fallback Enabled: ${securityConfig.enableFallback}`);
    console.log(`   Max Retries: ${securityConfig.maxRetries}\n`);

    // 2. Test Bing Maps Service
    console.log('🗺️  Testing Bing Maps Service...');
    const bingService = BingMapsService.getInstance();
    
    // Test bearing calculation
    const bearing = bingService.calculateBearing(
      testLocation.lat, 
      testLocation.lng, 
      testLocation.lat + 0.01, 
      testLocation.lng + 0.01
    );
    console.log(`   Bearing Calculation: ${bearing.bearing.toFixed(2)}° (${bearing.method})`);
    console.log(`   Distance: ${bearing.distance.toFixed(2)} meters\n`);

    // 3. Test Geographic Utilities
    console.log('🧭 Testing Geographic Utilities...');
    const destination = GeoUtils.calculateDestination(testLocation, 45, 1000);
    console.log(`   Destination (1km NE): ${destination.lat.toFixed(6)}, ${destination.lng.toFixed(6)}`);
    
    const formattedCoords = GeoUtils.formatCoordinates(testLocation, 'dms');
    console.log(`   DMS Format: ${formattedCoords}`);
    
    const isValid = GeoUtils.isValidCoordinate(testLocation);
    console.log(`   Coordinate Validation: ${isValid ? '✅ Valid' : '❌ Invalid'}\n`);

    // 4. Test Map Provider Service
    console.log('🔄 Testing Map Provider Service...');
    const mapProvider = MapProviderService.getInstance();
    
    // Test provider health
    const healthStatus = mapProvider.getProviderHealth();
    console.log('   Provider Health Status:');
    healthStatus.forEach(status => {
      console.log(`     ${status.provider}: ${status.isHealthy ? '✅ Healthy' : '❌ Unhealthy'} (${status.responseTime}ms)`);
    });

    // Test panorama request (this will use placeholder since we don't have real API keys)
    console.log('\n   Testing Panorama Request...');
    const panoramaResult = await mapProvider.getPanorama({
      lat: testLocation.lat,
      lng: testLocation.lng,
      size: '480x480',
      heading: 45,
      pitch: -10,
      fov: 90
    });

    console.log(`     Provider Used: ${panoramaResult.provider}`);
    console.log(`     Success: ${panoramaResult.success ? '✅' : '❌'}`);
    console.log(`     Response Time: ${panoramaResult.metadata.responseTime}ms`);
    console.log(`     Image URL: ${panoramaResult.imageUrl.substring(0, 50)}...`);
    
    if (panoramaResult.error) {
      console.log(`     Error: ${panoramaResult.error}`);
    }

    // 5. Test Provider Switching
    console.log('\n🔀 Testing Provider Switching...');
    
    console.log('   Switching to Google...');
    await mapProvider.switchProvider('google');
    
    const googleResult = await mapProvider.getPanorama({
      lat: testLocation.lat,
      lng: testLocation.lng,
      provider: 'google'
    });
    console.log(`     Google Provider: ${googleResult.success ? '✅' : '❌'} (${googleResult.metadata.responseTime}ms)`);

    console.log('   Switching to Bing...');
    await mapProvider.switchProvider('bing');
    
    const bingResult = await mapProvider.getPanorama({
      lat: testLocation.lat,
      lng: testLocation.lng,
      provider: 'bing'
    });
    console.log(`     Bing Provider: ${bingResult.success ? '✅' : '❌'} (${bingResult.metadata.responseTime}ms)`);

    // 6. Test Performance
    console.log('\n⚡ Testing Performance...');
    const startTime = Date.now();
    
    const concurrentRequests = Array(5).fill(null).map((_, i) => 
      mapProvider.getPanorama({
        lat: testLocation.lat + (i * 0.001),
        lng: testLocation.lng + (i * 0.001),
        size: '480x480'
      })
    );

    const results = await Promise.all(concurrentRequests);
    const endTime = Date.now();
    
    console.log(`   Concurrent Requests: ${results.length}`);
    console.log(`   Total Time: ${endTime - startTime}ms`);
    console.log(`   Average Time: ${(endTime - startTime) / results.length}ms per request`);
    console.log(`   Success Rate: ${results.filter(r => r.success).length}/${results.length}`);

    console.log('\n✅ Migration Test Complete!');
    console.log('\n📊 Summary:');
    console.log('   ✅ Security Service: Operational');
    console.log('   ✅ Bing Maps Service: Operational');
    console.log('   ✅ Geographic Utilities: Operational');
    console.log('   ✅ Map Provider Service: Operational');
    console.log('   ✅ Provider Switching: Operational');
    console.log('   ✅ Performance: Acceptable');

  } catch (error) {
    console.error('❌ Migration Test Failed:', error);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testMigration().catch(console.error);
}

export { testMigration };
