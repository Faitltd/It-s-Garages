import { Router } from 'express';
import { GoogleApiService } from '../services/googleApiService';

const router = Router();

// Test route to check Street View API status
router.get('/streetview-test', async (req, res) => {
  try {
    const googleService = new GoogleApiService();
    
    // Test with a known location (San Francisco)
    const testUrl = googleService.buildStreetViewUrl({
      lat: 37.7749,
      lng: -122.4194,
      size: '640x640'
    });
    
    console.log('Generated Street View URL:', testUrl);
    
    // Try to fetch the image to test if API key works
    const response = await fetch(testUrl);
    
    res.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: testUrl,
      headers: Object.fromEntries(response.headers.entries())
    });
    
  } catch (error) {
    console.error('Street View test error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test route to check Google Maps Geocoding API
router.get('/geocoding-test', async (req, res) => {
  try {
    const googleService = new GoogleApiService();
    
    // Test geocoding with a known address
    const result = await googleService.geocodeAddress('1600 Amphitheatre Parkway, Mountain View, CA');
    
    res.json({
      success: true,
      result
    });
    
  } catch (error) {
    console.error('Geocoding test error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
