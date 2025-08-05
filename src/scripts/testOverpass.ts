#!/usr/bin/env node

/**
 * Test script to verify Overpass API integration
 */

import { isHouse } from '../services/overpassFilter';

async function testOverpassAPI() {
  console.log('🧪 Testing Overpass API integration...\n');

  // Test coordinates in Centennial, CO
  const testLocations = [
    { name: 'Residential House', lat: 39.5742, lng: -104.8771 },
    { name: 'Commercial Building', lat: 39.5731, lng: -104.8756 },
    { name: 'Another House', lat: 39.5755, lng: -104.8789 }
  ];

  for (const location of testLocations) {
    try {
      console.log(`Testing: ${location.name} (${location.lat}, ${location.lng})`);
      const residential = await isHouse(location.lat, location.lng);
      console.log(`Result: ${residential ? '✅ RESIDENTIAL' : '❌ NOT RESIDENTIAL'}\n`);
    } catch (error) {
      console.error(`Error testing ${location.name}:`, error);
    }
  }

  console.log('🎉 Test completed!');
  process.exit(0);
}

// Run the test
if (require.main === module) {
  testOverpassAPI().catch(console.error);
}

export { testOverpassAPI };
