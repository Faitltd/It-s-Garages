import express from 'express';
import { GarageDoorService } from '../services/garageDoorService';
import { googleApiService } from '../services/googleApiService';
import { ComputerVisionService } from '../services/computerVisionService';
import { PriceEstimationService } from '../services/priceEstimationService';

const router = express.Router();

/**
 * CORE ADDRESS-TO-ESTIMATE PIPELINE
 * This implements the complete flow: Address → Street View → CV Model → Size Prediction → Price Estimate
 */

// Get estimate for address
router.post('/address', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address is required'
      });
    }

    // 1. Check if we already have data for this address
    const existingProperty = await GarageDoorService.getPropertyByAddress(address);
    
    if (existingProperty && existingProperty.confidence > 0.8) {
      // Return existing high-confidence data
      return res.json({
        success: true,
        source: 'existing_data',
        property: existingProperty,
        message: 'Using existing verified data'
      });
    }

    // 2. Geocode address to get coordinates
    const coordinates = await geocodeAddress(address);
    if (!coordinates) {
      return res.status(400).json({
        success: false,
        error: 'Could not geocode address'
      });
    }

    // 3. Run Computer Vision detection
    const cvResult = await ComputerVisionService.detectGarageDoor(
      address,
      coordinates.lat,
      coordinates.lng
    );

    if (cvResult.detections.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No garage door detected in Street View image',
        street_view_url: cvResult.image_url
      });
    }

    // 4. Get best detection result
    const bestDetection = cvResult.detections[0]; // Highest confidence

    if (!bestDetection) {
      return res.status(400).json({
        success: false,
        error: 'No garage door detected in Street View image',
        street_view_url: cvResult.image_url
      });
    }

    // 5. Generate comprehensive price estimate
    const doorSpec = {
      width_ft: bestDetection.width_ft,
      height_ft: bestDetection.height_ft,
      type: bestDetection.type,
      material: 'steel', // Default, can be enhanced with material detection
      insulation: 'single',
      windows: false,
      decorative: false
    };

    const installationFactors = {
      removal_required: true,
      electrical_work: true,
      structural_changes: false,
      driveway_slope: 0.1,
      access_difficulty: 0.3,
      permit_required: false
    };

    const regionalFactors = {
      location: address,
      labor_rate_multiplier: 1.0,
      material_shipping_cost: 100,
      permit_cost: 0,
      tax_rate: 0.08
    };

    const priceEstimate = PriceEstimationService.calculateEstimate(
      doorSpec,
      installationFactors,
      regionalFactors,
      0.20 // 20% margin
    );

    // 6. Store results in database
    const property = {
      address,
      lat: coordinates.lat,
      lng: coordinates.lng,
      garage_type: bestDetection.type,
      garage_door_size: bestDetection.size,
      confidence: bestDetection.confidence,
      source: 'ai_prediction',
      photo_url: cvResult.image_url,
      street_view_heading: 45,
      street_view_pitch: -10
    };

    const propertyId = await GarageDoorService.upsertProperty(property);

    return res.json({
      success: true,
      source: 'ai_prediction',
      address: address,
      coordinates: coordinates,

      // Computer Vision Results
      cv_detection: {
        detections: cvResult.detections,
        confidence: bestDetection.confidence,
        processing_time_ms: cvResult.processing_time_ms,
        model_version: cvResult.model_version
      },

      // Property Data
      property: {
        ...property,
        id: propertyId
      },

      // Price Estimate
      price_estimate: priceEstimate,

      // Visual Data
      street_view_url: cvResult.image_url,

      message: `Detected ${bestDetection.type} garage door (${bestDetection.size}) - Estimated cost: $${priceEstimate.total_estimate}`
    });

  } catch (error) {
    console.error('Error generating estimate:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate estimate'
    });
  }
});

// Get estimate by coordinates (for nearby properties)
router.post('/coordinates', async (req, res) => {
  try {
    const { lat, lng, radius = 1 } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    // Find nearby properties
    const nearbyProperties = await GarageDoorService.getPropertiesNearby(lat, lng, radius);

    if (nearbyProperties.length > 0) {
      // Return the highest confidence nearby property
      const bestMatch = nearbyProperties[0];
      
      return res.json({
        success: true,
        source: 'nearby_data',
        property: bestMatch,
        nearby_count: nearbyProperties.length,
        message: `Found ${nearbyProperties.length} nearby properties`
      });
    }

    // No nearby data, generate new estimate
    const address = `${lat}, ${lng}`;
    const result = await GarageDoorService.processAddressWithCV(address, lat, lng);

    return res.json({
      success: true,
      source: 'ai_prediction',
      coordinates: { lat, lng },
      property: result.property,
      detection: result.detection,
      estimate: result.estimate,
      street_view_url: result.property.photo_url,
      message: 'Generated new estimate for coordinates'
    });

  } catch (error) {
    console.error('Error generating coordinate estimate:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate estimate'
    });
  }
});

// Verify/update property data (human verification)
router.post('/verify/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const {
      garage_type,
      garage_door_size,
      building_style,
      driveway_type,
      notes,
      user_id
    } = req.body;

    // Get existing property
    const existingProperty = await GarageDoorService.getPropertyByAddress(''); // TODO: Get by ID
    
    if (!existingProperty) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    // Update with human verification
    const updatedProperty = {
      ...existingProperty,
      garage_type: garage_type || existingProperty.garage_type,
      garage_door_size: garage_door_size || existingProperty.garage_door_size,
      building_style: building_style || existingProperty.building_style,
      driveway_type: driveway_type || existingProperty.driveway_type,
      notes: notes || existingProperty.notes,
      confidence: 1.0, // Human verified = 100% confidence
      source: 'human_verified',
      last_verified: new Date(),
      verified_by_user_id: user_id
    };

    await GarageDoorService.upsertProperty(updatedProperty);

    return res.json({
      success: true,
      property: updatedProperty,
      message: 'Property verified and updated'
    });

  } catch (error) {
    console.error('Error verifying property:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify property'
    });
  }
});

// Get all properties (for admin/analysis)
router.get('/properties', async (req, res) => {
  try {
    const { source, confidence_min = 0, limit = 100 } = req.query;

    // TODO: Implement proper query with filters
    return res.json({
      success: true,
      message: 'Property listing endpoint - TODO: Implement filtering',
      filters: { source, confidence_min, limit }
    });

  } catch (error) {
    console.error('Error fetching properties:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch properties'
    });
  }
});

// Analytics endpoint
router.get('/analytics', async (req, res) => {
  try {
    // TODO: Implement analytics queries
    return res.json({
      success: true,
      analytics: {
        total_properties: 0,
        ai_predictions: 0,
        human_verified: 0,
        average_confidence: 0,
        common_sizes: [],
        price_ranges: {}
      },
      message: 'Analytics endpoint - TODO: Implement queries'
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

// Demo endpoint - Complete pipeline demonstration
router.get('/demo', async (req, res) => {
  try {
    const demoAddress = '1247 Residential Ave, Queens, NY';
    const demoLat = 40.7589;
    const demoLng = -73.9851;

    console.log('🏠 Running complete Address → Street View → CV → Price pipeline demo...');

    // 1. Computer Vision Detection
    const cvResult = await ComputerVisionService.detectGarageDoor(demoAddress, demoLat, demoLng);
    const bestDetection = cvResult.detections[0];

    if (!bestDetection) {
      return res.status(400).json({
        success: false,
        error: 'No garage door detected in demo',
        street_view_url: cvResult.image_url
      });
    }

    // 2. Price Estimation
    const quickEstimate = PriceEstimationService.quickEstimate(bestDetection.size, bestDetection.type);
    const tieredPricing = PriceEstimationService.calculateTieredPricing(quickEstimate);

    // 3. Store in database
    const property = {
      address: demoAddress,
      lat: demoLat,
      lng: demoLng,
      garage_type: bestDetection.type,
      garage_door_size: bestDetection.size,
      confidence: bestDetection.confidence,
      source: 'ai_prediction',
      photo_url: cvResult.image_url
    };

    const propertyId = await GarageDoorService.upsertProperty(property);

    return res.json({
      success: true,
      demo: true,
      pipeline_steps: {
        '1_address_input': demoAddress,
        '2_coordinates': { lat: demoLat, lng: demoLng },
        '3_street_view_image': cvResult.image_url,
        '4_cv_detection': {
          detected_type: bestDetection.type,
          detected_size: bestDetection.size,
          confidence: bestDetection.confidence,
          processing_time_ms: cvResult.processing_time_ms
        },
        '5_price_estimation': {
          economy: `$${tieredPricing.economy.total_estimate}`,
          standard: `$${tieredPricing.standard.total_estimate}`,
          premium: `$${tieredPricing.premium.total_estimate}`
        },
        '6_database_storage': {
          property_id: propertyId,
          stored: true
        }
      },
      detailed_results: {
        cv_result: cvResult,
        price_breakdown: quickEstimate,
        tiered_pricing: tieredPricing,
        property_data: { ...property, id: propertyId }
      },
      message: `Complete pipeline demo: ${bestDetection.type} garage door (${bestDetection.size}) detected with ${Math.round(bestDetection.confidence * 100)}% confidence. Price range: $${tieredPricing.economy.total_estimate} - $${tieredPricing.premium.total_estimate}`
    });

  } catch (error) {
    console.error('Error running demo:', error);
    return res.status(500).json({
      success: false,
      error: 'Demo pipeline failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * HELPER FUNCTIONS
 */

// Simple geocoding function (replace with proper geocoding service)
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // TODO: Implement proper geocoding using Google Geocoding API
    // For now, return mock coordinates for testing
    
    // Mock coordinates for common test addresses
    const mockCoordinates: { [key: string]: { lat: number; lng: number } } = {
      'san francisco': { lat: 37.7749, lng: -122.4194 },
      'new york': { lat: 40.7128, lng: -74.0060 },
      'los angeles': { lat: 34.0522, lng: -118.2437 },
      'chicago': { lat: 41.8781, lng: -87.6298 }
    };

    const normalizedAddress = address.toLowerCase();
    for (const [key, coords] of Object.entries(mockCoordinates)) {
      if (normalizedAddress.includes(key)) {
        return coords;
      }
    }

    // Default to San Francisco for testing
    return { lat: 37.7749, lng: -122.4194 };

  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export default router;
