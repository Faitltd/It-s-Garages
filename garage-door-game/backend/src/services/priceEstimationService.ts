/**
 * PRICE ESTIMATION ENGINE
 * Maps detected door sizes to material/labor costs with configurable margins
 * 
 * This service provides:
 * 1. Material cost calculation based on door size and type
 * 2. Labor cost estimation with complexity factors
 * 3. Regional pricing adjustments
 * 4. Configurable profit margins
 * 5. Installation complexity analysis
 */

export interface DoorSpecification {
  width_ft: number;
  height_ft: number;
  type: string;           // single, double, triple, RV, golf-cart add-on
  material: string;       // steel, aluminum, wood, composite, glass
  insulation: string;     // none, single, double, triple
  windows: boolean;       // has windows or not
  decorative: boolean;    // decorative hardware/design
}

export interface InstallationFactors {
  removal_required: boolean;        // Remove existing door
  electrical_work: boolean;         // Opener installation/rewiring
  structural_changes: boolean;      // Header/framing modifications
  driveway_slope: number;          // 0-1 scale (0=flat, 1=steep)
  access_difficulty: number;       // 0-1 scale (0=easy, 1=very difficult)
  permit_required: boolean;        // Building permit needed
}

export interface RegionalFactors {
  location: string;                // City, State or ZIP code
  labor_rate_multiplier: number;   // Regional labor cost adjustment
  material_shipping_cost: number;  // Additional shipping costs
  permit_cost: number;             // Local permit fees
  tax_rate: number;                // Local tax rate
}

export interface PriceBreakdown {
  // Material Costs
  door_material_cost: number;
  hardware_cost: number;
  opener_cost: number;
  insulation_cost: number;
  window_cost: number;
  decorative_cost: number;
  
  // Labor Costs
  removal_labor: number;
  installation_labor: number;
  electrical_labor: number;
  structural_labor: number;
  
  // Additional Costs
  permit_cost: number;
  disposal_cost: number;
  shipping_cost: number;
  
  // Subtotals
  total_material: number;
  total_labor: number;
  subtotal: number;
  
  // Final Pricing
  margin_amount: number;
  tax_amount: number;
  total_estimate: number;
  
  // Metadata
  margin_percentage: number;
  confidence: number;           // Estimate confidence (0-1)
  valid_days: number;          // How long estimate is valid
}

/**
 * PRICE ESTIMATION SERVICE
 */
export class PriceEstimationService {
  
  // Base pricing constants (per square foot)
  private static readonly BASE_MATERIAL_COSTS = {
    steel: 15,      // $15/sq ft
    aluminum: 18,   // $18/sq ft
    wood: 25,       // $25/sq ft
    composite: 30,  // $30/sq ft
    glass: 45       // $45/sq ft
  };
  
  private static readonly BASE_LABOR_RATE = 75; // $75/hour
  private static readonly INSTALLATION_HOURS_PER_SQFT = 0.5; // 30 minutes per sq ft
  
  /**
   * MAIN PRICE ESTIMATION FUNCTION
   * Calculate comprehensive price estimate for garage door installation
   */
  static calculateEstimate(
    doorSpec: DoorSpecification,
    installationFactors: InstallationFactors,
    regionalFactors: RegionalFactors,
    marginPercentage: number = 0.20
  ): PriceBreakdown {
    
    const area = doorSpec.width_ft * doorSpec.height_ft;
    
    // 1. Calculate material costs
    const materialCosts = this.calculateMaterialCosts(doorSpec, area);
    
    // 2. Calculate labor costs
    const laborCosts = this.calculateLaborCosts(doorSpec, installationFactors, regionalFactors, area);
    
    // 3. Calculate additional costs
    const additionalCosts = this.calculateAdditionalCosts(installationFactors, regionalFactors);
    
    // 4. Apply regional adjustments
    const adjustedMaterialCosts = this.applyRegionalAdjustments(materialCosts, regionalFactors);
    const adjustedLaborCosts = this.applyRegionalAdjustments(laborCosts, regionalFactors);
    
    // 5. Calculate totals
    const totalMaterial = adjustedMaterialCosts.door_material_cost + adjustedMaterialCosts.hardware_cost +
                          adjustedMaterialCosts.opener_cost + adjustedMaterialCosts.insulation_cost +
                          adjustedMaterialCosts.window_cost + adjustedMaterialCosts.decorative_cost;

    const totalLabor = adjustedLaborCosts.removal_labor + adjustedLaborCosts.installation_labor +
                      adjustedLaborCosts.electrical_labor + adjustedLaborCosts.structural_labor;

    const subtotal = totalMaterial + totalLabor + additionalCosts.permit_cost + additionalCosts.disposal_cost + additionalCosts.shipping_cost;
    
    // 6. Apply margin and taxes
    const marginAmount = subtotal * marginPercentage;
    const taxAmount = (subtotal + marginAmount) * regionalFactors.tax_rate;
    const totalEstimate = subtotal + marginAmount + taxAmount;
    
    // 7. Calculate confidence based on specification completeness
    const confidence = this.calculateEstimateConfidence(doorSpec, installationFactors);
    
    return {
      // Material Costs
      door_material_cost: adjustedMaterialCosts.door_material_cost,
      hardware_cost: adjustedMaterialCosts.hardware_cost,
      opener_cost: adjustedMaterialCosts.opener_cost,
      insulation_cost: adjustedMaterialCosts.insulation_cost,
      window_cost: adjustedMaterialCosts.window_cost,
      decorative_cost: adjustedMaterialCosts.decorative_cost,
      
      // Labor Costs
      removal_labor: adjustedLaborCosts.removal_labor,
      installation_labor: adjustedLaborCosts.installation_labor,
      electrical_labor: adjustedLaborCosts.electrical_labor,
      structural_labor: adjustedLaborCosts.structural_labor,
      
      // Additional Costs
      permit_cost: additionalCosts.permit_cost,
      disposal_cost: additionalCosts.disposal_cost,
      shipping_cost: additionalCosts.shipping_cost,
      
      // Subtotals
      total_material: Math.round(totalMaterial),
      total_labor: Math.round(totalLabor),
      subtotal: subtotal,
      
      // Final Pricing
      margin_amount: marginAmount,
      tax_amount: taxAmount,
      total_estimate: Math.round(totalEstimate),
      
      // Metadata
      margin_percentage: marginPercentage,
      confidence: confidence,
      valid_days: 30
    };
  }

  /**
   * Calculate material costs
   */
  private static calculateMaterialCosts(doorSpec: DoorSpecification, area: number): {
    door_material_cost: number;
    hardware_cost: number;
    opener_cost: number;
    insulation_cost: number;
    window_cost: number;
    decorative_cost: number;
  } {
    const baseMaterialCost = this.BASE_MATERIAL_COSTS[doorSpec.material as keyof typeof this.BASE_MATERIAL_COSTS] || this.BASE_MATERIAL_COSTS.steel;
    const doorMaterialCost = area * baseMaterialCost;
    
    // Hardware costs (tracks, springs, rollers, etc.)
    const hardwareCost = doorMaterialCost * 0.15; // 15% of door cost
    
    // Garage door opener cost
    const openerCost = doorSpec.type === 'single' ? 200 : 
                      doorSpec.type === 'double' ? 300 : 
                      doorSpec.type === 'triple' ? 400 : 350;
    
    // Insulation cost
    const insulationCost = doorSpec.insulation === 'none' ? 0 :
                          doorSpec.insulation === 'single' ? area * 5 :
                          doorSpec.insulation === 'double' ? area * 8 :
                          area * 12; // triple insulation
    
    // Window cost
    const windowCost = doorSpec.windows ? 150 * (doorSpec.type === 'single' ? 1 : 2) : 0;
    
    // Decorative hardware cost
    const decorativeCost = doorSpec.decorative ? 200 : 0;
    
    return {
      door_material_cost: doorMaterialCost,
      hardware_cost: hardwareCost,
      opener_cost: openerCost,
      insulation_cost: insulationCost,
      window_cost: windowCost,
      decorative_cost: decorativeCost
    };
  }

  /**
   * Calculate labor costs
   */
  private static calculateLaborCosts(
    doorSpec: DoorSpecification,
    installationFactors: InstallationFactors,
    regionalFactors: RegionalFactors,
    area: number
  ): {
    removal_labor: number;
    installation_labor: number;
    electrical_labor: number;
    structural_labor: number;
  } {
    const baseHourlyRate = this.BASE_LABOR_RATE * regionalFactors.labor_rate_multiplier;
    
    // Base installation time
    let installationHours = area * this.INSTALLATION_HOURS_PER_SQFT;
    
    // Adjust for complexity factors
    if (installationFactors.access_difficulty > 0.5) {
      installationHours *= (1 + installationFactors.access_difficulty);
    }
    
    if (installationFactors.driveway_slope > 0.3) {
      installationHours *= (1 + installationFactors.driveway_slope * 0.5);
    }
    
    const installationLabor = installationHours * baseHourlyRate;
    
    // Removal labor
    const removalLabor = installationFactors.removal_required ? 
      (installationHours * 0.3 * baseHourlyRate) : 0;
    
    // Electrical work
    const electricalLabor = installationFactors.electrical_work ? 
      (2 * baseHourlyRate) : 0; // 2 hours for electrical
    
    // Structural work
    const structuralLabor = installationFactors.structural_changes ? 
      (4 * baseHourlyRate) : 0; // 4 hours for structural changes
    
    return {
      removal_labor: removalLabor,
      installation_labor: installationLabor,
      electrical_labor: electricalLabor,
      structural_labor: structuralLabor
    };
  }

  /**
   * Calculate additional costs
   */
  private static calculateAdditionalCosts(
    installationFactors: InstallationFactors,
    regionalFactors: RegionalFactors
  ): {
    permit_cost: number;
    disposal_cost: number;
    shipping_cost: number;
  } {
    return {
      permit_cost: installationFactors.permit_required ? regionalFactors.permit_cost : 0,
      disposal_cost: installationFactors.removal_required ? 75 : 0,
      shipping_cost: regionalFactors.material_shipping_cost
    };
  }

  /**
   * Apply regional cost adjustments
   */
  private static applyRegionalAdjustments(costs: any, regionalFactors: RegionalFactors): any {
    const adjusted = { ...costs };
    
    // Apply regional multipliers to labor costs
    if (costs.removal_labor) adjusted.removal_labor *= regionalFactors.labor_rate_multiplier;
    if (costs.installation_labor) adjusted.installation_labor *= regionalFactors.labor_rate_multiplier;
    if (costs.electrical_labor) adjusted.electrical_labor *= regionalFactors.labor_rate_multiplier;
    if (costs.structural_labor) adjusted.structural_labor *= regionalFactors.labor_rate_multiplier;
    
    return adjusted;
  }

  /**
   * Calculate estimate confidence based on available information
   */
  private static calculateEstimateConfidence(
    doorSpec: DoorSpecification,
    installationFactors: InstallationFactors
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on available specifications
    if (doorSpec.width_ft && doorSpec.height_ft) confidence += 0.2;
    if (doorSpec.material && doorSpec.material !== 'unknown') confidence += 0.1;
    if (doorSpec.type && doorSpec.type !== 'unknown') confidence += 0.1;
    
    // Decrease confidence for complex installations
    if (installationFactors.structural_changes) confidence -= 0.1;
    if (installationFactors.access_difficulty > 0.7) confidence -= 0.1;
    
    return Math.max(0.3, Math.min(1.0, confidence));
  }

  /**
   * QUICK ESTIMATE FUNCTIONS
   * For rapid estimates based on limited information
   */
  
  /**
   * Quick estimate based on door size string (e.g., "16×7 ft")
   */
  static quickEstimate(doorSizeString: string, doorType: string = 'double'): PriceBreakdown {
    const dimensions = this.parseDoorSize(doorSizeString);
    
    const doorSpec: DoorSpecification = {
      width_ft: dimensions.width,
      height_ft: dimensions.height,
      type: doorType,
      material: 'steel', // Default to steel
      insulation: 'single',
      windows: false,
      decorative: false
    };
    
    const installationFactors: InstallationFactors = {
      removal_required: true,
      electrical_work: true,
      structural_changes: false,
      driveway_slope: 0.1,
      access_difficulty: 0.3,
      permit_required: false
    };
    
    const regionalFactors: RegionalFactors = {
      location: 'National Average',
      labor_rate_multiplier: 1.0,
      material_shipping_cost: 100,
      permit_cost: 0,
      tax_rate: 0.08
    };
    
    return this.calculateEstimate(doorSpec, installationFactors, regionalFactors);
  }

  /**
   * Parse door size string into dimensions
   */
  private static parseDoorSize(sizeString: string): { width: number; height: number } {
    const match = sizeString.match(/(\d+)\s*[×x]\s*(\d+)/);
    if (match && match[1] && match[2]) {
      return {
        width: parseInt(match[1]),
        height: parseInt(match[2])
      };
    }
    
    // Default to common double door size
    return { width: 16, height: 7 };
  }

  /**
   * PRICING TIERS
   * Different pricing levels for different customer segments
   */
  
  static calculateTieredPricing(baseEstimate: PriceBreakdown): {
    economy: PriceBreakdown;
    standard: PriceBreakdown;
    premium: PriceBreakdown;
  } {
    // Economy tier (10% lower margin)
    const economy = { ...baseEstimate };
    economy.margin_percentage = Math.max(0.05, baseEstimate.margin_percentage - 0.10);
    economy.margin_amount = economy.subtotal * economy.margin_percentage;
    economy.total_estimate = Math.round(economy.subtotal + economy.margin_amount + economy.tax_amount);
    
    // Standard tier (base pricing)
    const standard = baseEstimate;
    
    // Premium tier (15% higher margin)
    const premium = { ...baseEstimate };
    premium.margin_percentage = baseEstimate.margin_percentage + 0.15;
    premium.margin_amount = premium.subtotal * premium.margin_percentage;
    premium.total_estimate = Math.round(premium.subtotal + premium.margin_amount + premium.tax_amount);
    
    return { economy, standard, premium };
  }
}

export default PriceEstimationService;
