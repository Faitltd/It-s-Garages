import { db } from '../config/database';
import { GarageDoorService } from '../services/garageDoorService';

/**
 * SEED GARAGE DOOR DATABASE
 * Populate with known tract developments and sample properties
 */

// Known tract developments with uniform door sizes
const tractDevelopments = [
  {
    development_name: 'Sunset Ridge',
    builder_name: 'Lennar Homes',
    year_built_start: 2018,
    year_built_end: 2022,
    center_lat: 37.7749,
    center_lng: -122.4194,
    standard_garage_type: 'double',
    standard_door_size: '16×7 ft',
    confidence: 0.95,
    source: 'builder_docs'
  },
  {
    development_name: 'Oak Valley Estates',
    builder_name: 'KB Home',
    year_built_start: 2015,
    year_built_end: 2020,
    center_lat: 34.0522,
    center_lng: -118.2437,
    standard_garage_type: 'double',
    standard_door_size: '16×8 ft',
    confidence: 0.92,
    source: 'builder_docs'
  },
  {
    development_name: 'Prairie Commons',
    builder_name: 'Pulte Homes',
    year_built_start: 2019,
    year_built_end: 2023,
    center_lat: 41.8781,
    center_lng: -87.6298,
    standard_garage_type: 'double',
    standard_door_size: '18×7 ft',
    confidence: 0.90,
    source: 'hoa_records'
  },
  {
    development_name: 'Meadowbrook',
    builder_name: 'D.R. Horton',
    year_built_start: 2020,
    year_built_end: 2024,
    center_lat: 30.2672,
    center_lng: -97.7431,
    standard_garage_type: 'single',
    standard_door_size: '8×7 ft',
    confidence: 0.88,
    source: 'builder_docs'
  }
];

// Sample garage door properties with high confidence
const sampleProperties = [
  {
    address: '1247 Residential Ave, Queens, NY',
    lat: 40.7589,
    lng: -73.9851,
    garage_type: 'double',
    garage_door_size: '16×7 ft',
    confidence: 0.95,
    source: 'human_verified',
    building_style: 'Colonial',
    driveway_type: 'Straight'
  },
  {
    address: '2156 Suburban Dr, Beverly Hills, CA',
    lat: 34.0928,
    lng: -118.3287,
    garage_type: 'double',
    garage_door_size: '18×8 ft',
    confidence: 0.98,
    source: 'human_verified',
    building_style: 'Modern',
    driveway_type: 'Circular'
  },
  {
    address: '3789 Family Ln, Chicago, IL',
    lat: 41.8369,
    lng: -87.6847,
    garage_type: 'single',
    garage_door_size: '8×7 ft',
    confidence: 0.92,
    source: 'human_verified',
    building_style: 'Ranch',
    driveway_type: 'Straight'
  },
  {
    address: '4321 Home St, Atlanta, GA',
    lat: 33.7490,
    lng: -84.3880,
    garage_type: 'double',
    garage_door_size: '16×7 ft',
    confidence: 0.89,
    source: 'builder_spec',
    building_style: 'Traditional',
    driveway_type: 'Curved'
  },
  {
    address: '5654 House Rd, Baltimore, MD',
    lat: 39.2904,
    lng: -76.6122,
    garage_type: 'double',
    garage_door_size: '16×8 ft',
    confidence: 0.94,
    source: 'human_verified',
    building_style: 'Colonial',
    driveway_type: 'Straight'
  }
];

/**
 * Seed tract developments
 */
async function seedTractDevelopments(): Promise<void> {
  console.log('🏘️ Seeding tract developments...');
  
  for (const tract of tractDevelopments) {
    try {
      await new Promise<void>((resolve, reject) => {
        const sql = `
          INSERT OR REPLACE INTO tract_developments (
            development_name, builder_name, year_built_start, year_built_end,
            center_lat, center_lng, standard_garage_type, standard_door_size,
            confidence, source
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
          tract.development_name,
          tract.builder_name,
          tract.year_built_start,
          tract.year_built_end,
          tract.center_lat,
          tract.center_lng,
          tract.standard_garage_type,
          tract.standard_door_size,
          tract.confidence,
          tract.source
        ];
        
        db.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            console.log(`✅ Added tract: ${tract.development_name}`);
            resolve();
          }
        });
      });
    } catch (error) {
      console.error(`❌ Error adding tract ${tract.development_name}:`, error);
    }
  }
}

/**
 * Seed sample properties
 */
async function seedSampleProperties(): Promise<void> {
  console.log('🏠 Seeding sample properties...');
  
  for (const property of sampleProperties) {
    try {
      await GarageDoorService.upsertProperty(property);
      console.log(`✅ Added property: ${property.address}`);
    } catch (error) {
      console.error(`❌ Error adding property ${property.address}:`, error);
    }
  }
}

/**
 * Generate mock CV detection results for sample properties
 */
async function seedMockDetections(): Promise<void> {
  console.log('🤖 Seeding mock CV detection results...');
  
  // Get all properties to add detection results
  const properties = await new Promise<any[]>((resolve, reject) => {
    db.all('SELECT * FROM garage_door_properties LIMIT 5', (err, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

  for (const property of properties) {
    try {
      const mockDetection = {
        property_id: property.id,
        model_version: 'yolov8-garage-v1.0',
        bbox_x1: 0.2,
        bbox_y1: 0.3,
        bbox_x2: 0.8,
        bbox_y2: 0.7,
        detected_type: property.garage_type,
        detected_size: property.garage_door_size,
        confidence_score: property.confidence * 0.9, // Slightly lower than human verification
        raw_predictions: JSON.stringify({
          detections: [
            {
              class: property.garage_type,
              confidence: property.confidence * 0.9,
              bbox: [0.2, 0.3, 0.8, 0.7]
            }
          ]
        }),
        processing_time_ms: Math.floor(Math.random() * 200) + 50
      };

      await new Promise<void>((resolve, reject) => {
        const sql = `
          INSERT INTO cv_detection_results (
            property_id, model_version, bbox_x1, bbox_y1, bbox_x2, bbox_y2,
            detected_type, detected_size, confidence_score, raw_predictions, processing_time_ms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
          mockDetection.property_id,
          mockDetection.model_version,
          mockDetection.bbox_x1,
          mockDetection.bbox_y1,
          mockDetection.bbox_x2,
          mockDetection.bbox_y2,
          mockDetection.detected_type,
          mockDetection.detected_size,
          mockDetection.confidence_score,
          mockDetection.raw_predictions,
          mockDetection.processing_time_ms
        ];
        
        db.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      console.log(`✅ Added CV detection for: ${property.address}`);
    } catch (error) {
      console.error(`❌ Error adding detection for ${property.address}:`, error);
    }
  }
}

/**
 * Generate sample price estimates
 */
async function seedPriceEstimates(): Promise<void> {
  console.log('💰 Seeding price estimates...');
  
  // Get all properties to add price estimates
  const properties = await new Promise<any[]>((resolve, reject) => {
    db.all('SELECT * FROM garage_door_properties LIMIT 5', (err, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

  for (const property of properties) {
    try {
      // Calculate realistic pricing
      const area = (property.door_width_ft || 16) * (property.door_height_ft || 7);
      const basePricePerSqFt = 25;
      const materialCost = area * basePricePerSqFt;
      const laborCost = materialCost * 0.6;
      const margin = 0.20;
      const totalEstimate = Math.round((materialCost + laborCost) * (1 + margin));

      const estimate = {
        property_id: property.id,
        door_size: property.garage_door_size,
        door_type: property.garage_type,
        material_type: 'standard',
        material_cost: materialCost,
        labor_cost: laborCost,
        total_estimate: totalEstimate,
        margin_percentage: margin,
        removal_cost: 150,
        installation_complexity_multiplier: 1.0,
        created_by: 'system'
      };

      await new Promise<void>((resolve, reject) => {
        const sql = `
          INSERT INTO price_estimates (
            property_id, door_size, door_type, material_type,
            material_cost, labor_cost, total_estimate, margin_percentage,
            removal_cost, installation_complexity_multiplier, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
          estimate.property_id,
          estimate.door_size,
          estimate.door_type,
          estimate.material_type,
          estimate.material_cost,
          estimate.labor_cost,
          estimate.total_estimate,
          estimate.margin_percentage,
          estimate.removal_cost,
          estimate.installation_complexity_multiplier,
          estimate.created_by
        ];
        
        db.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      console.log(`✅ Added price estimate for: ${property.address} - $${totalEstimate}`);
    } catch (error) {
      console.error(`❌ Error adding estimate for ${property.address}:`, error);
    }
  }
}

/**
 * Main seeding function
 */
export async function seedGarageDoorData(): Promise<void> {
  try {
    console.log('🌱 Starting garage door data seeding...');
    
    await seedTractDevelopments();
    await seedSampleProperties();
    await seedMockDetections();
    await seedPriceEstimates();
    
    console.log('🎉 Garage door data seeding completed successfully!');
    
    // Print summary
    const summary = await new Promise<any>((resolve, reject) => {
      db.get(`
        SELECT 
          (SELECT COUNT(*) FROM tract_developments) as tract_count,
          (SELECT COUNT(*) FROM garage_door_properties) as property_count,
          (SELECT COUNT(*) FROM cv_detection_results) as detection_count,
          (SELECT COUNT(*) FROM price_estimates) as estimate_count
      `, (err, row: any) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    console.log('\n📊 Database Summary:');
    console.log(`   Tract Developments: ${summary.tract_count}`);
    console.log(`   Properties: ${summary.property_count}`);
    console.log(`   CV Detections: ${summary.detection_count}`);
    console.log(`   Price Estimates: ${summary.estimate_count}`);
    
  } catch (error) {
    console.error('❌ Error seeding garage door data:', error);
    throw error;
  }
}

// Run seeding if this script is executed directly
if (require.main === module) {
  seedGarageDoorData()
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding error:', error);
      process.exit(1);
    });
}
