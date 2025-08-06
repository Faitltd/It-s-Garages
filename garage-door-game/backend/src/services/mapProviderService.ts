/**
 * Map Provider Service - Unified Abstraction Layer
 * Supports Google Street View and Bing Maps Streetside with seamless switching
 */

import { GoogleApiService } from './googleApiService';
import { BingMapsService } from './bingMapsService';
import { securityService } from './securityService';
import { auditLogger } from './auditLogger';
import { 
  UnifiedPanoramaRequest, 
  UnifiedPanoramaResponse, 
  MapProvider, 
  ProviderSwitchConfig 
} from '../types/bingMaps';

export interface ProviderHealthStatus {
  provider: 'google' | 'bing';
  isHealthy: boolean;
  lastCheck: Date;
  responseTime: number;
  errorCount: number;
  successRate: number;
}

export class MapProviderService {
  private static instance: MapProviderService;
  private googleService: GoogleApiService;
  private bingService: BingMapsService;
  private config: ProviderSwitchConfig;
  private healthStatus: Map<string, ProviderHealthStatus> = new Map();
  private circuitBreaker: Map<string, { isOpen: boolean; lastFailure: Date; failureCount: number }> = new Map();

  private constructor() {
    this.googleService = new GoogleApiService();
    this.bingService = BingMapsService.getInstance();
    this.config = this.loadConfiguration();
    this.initializeHealthChecks();
  }

  public static getInstance(): MapProviderService {
    if (!MapProviderService.instance) {
      MapProviderService.instance = new MapProviderService();
    }
    return MapProviderService.instance;
  }

  /**
   * Unified panorama request with automatic provider selection and fallback
   */
  public async getPanorama(request: UnifiedPanoramaRequest): Promise<UnifiedPanoramaResponse> {
    const startTime = Date.now();
    
    try {
      // Determine provider based on request or configuration
      const provider = this.selectProvider(request.provider);
      
      // Log the request
      await auditLogger.logApiUsage({
        provider: provider.name,
        keyType: 'panorama',
        usageCount: 1,
        responseTime: 0,
        cached: false
      });

      // Attempt primary provider
      let result = await this.attemptProvider(provider.name, request, startTime);
      
      // If primary fails and fallback is enabled, try fallback
      if (!result.success && this.config.autoSwitch && this.config.fallbackProvider) {
        await auditLogger.logSecurityEvent({
          event: 'PROVIDER_FALLBACK',
          provider: provider.name,
          severity: 'MEDIUM',
          timestamp: new Date(),
          details: { 
            primaryProvider: provider.name,
            fallbackProvider: this.config.fallbackProvider.name,
            error: result.error 
          }
        });

        result = await this.attemptProvider(this.config.fallbackProvider.name, request, startTime);
      }

      // Update health status
      this.updateHealthStatus(result.provider, result.success, Date.now() - startTime);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await auditLogger.logSecurityEvent({
        event: 'PANORAMA_REQUEST_FAILED',
        severity: 'HIGH',
        timestamp: new Date(),
        details: { 
          request: this.sanitizeRequest(request),
          error: errorMessage 
        }
      });

      return {
        imageUrl: this.getPlaceholderUrl(request),
        provider: 'google', // Default for compatibility
        metadata: {
          lat: request.lat,
          lng: request.lng,
          heading: request.heading || 0,
          pitch: request.pitch || 0,
          fov: request.fov || 90,
          size: request.size || '480x480',
          cached: false,
          responseTime: Date.now() - startTime
        },
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get provider health status for monitoring
   */
  public getProviderHealth(): ProviderHealthStatus[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Force provider switch for testing or maintenance
   */
  public async switchProvider(provider: 'google' | 'bing'): Promise<void> {
    const newPrimary: MapProvider = {
      name: provider,
      type: provider === 'google' ? 'streetview' : 'streetside',
      isAvailable: true
    };

    const oldPrimary = this.config.primaryProvider;
    this.config.primaryProvider = newPrimary;
    this.config.fallbackProvider = oldPrimary;

    await auditLogger.logSecurityEvent({
      event: 'PROVIDER_SWITCH',
      severity: 'MEDIUM',
      timestamp: new Date(),
      details: {
        from: oldPrimary.name,
        to: provider,
        manual: true
      }
    });
  }

  /**
   * Test provider connectivity
   */
  public async testProvider(provider: 'google' | 'bing'): Promise<boolean> {
    const testRequest: UnifiedPanoramaRequest = {
      lat: 37.7749,  // San Francisco test location
      lng: -122.4194,
      size: '480x480',
      heading: 0,
      pitch: 0,
      fov: 90
    };

    try {
      const result = await this.attemptProvider(provider, testRequest, Date.now());
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Load configuration from environment and security service
   */
  private loadConfiguration(): ProviderSwitchConfig {
    const securityConfig = securityService.getSecurityConfig();
    
    const primaryProvider: MapProvider = {
      name: securityConfig.provider === 'hybrid' ? 'bing' : securityConfig.provider,
      type: securityConfig.provider === 'google' ? 'streetview' : 'streetside',
      isAvailable: true
    };

    const fallbackProvider: MapProvider | undefined = securityConfig.enableFallback ? {
      name: securityConfig.provider === 'google' ? 'bing' : 'google',
      type: securityConfig.provider === 'google' ? 'streetside' : 'streetview',
      isAvailable: true
    } : undefined;

    return {
      primaryProvider,
      fallbackProvider: fallbackProvider || undefined,
      autoSwitch: securityConfig.enableFallback,
      maxRetries: securityConfig.maxRetries,
      healthCheckInterval: 300000 // 5 minutes
    };
  }

  /**
   * Select provider based on request preference or configuration
   */
  private selectProvider(requestedProvider?: 'google' | 'bing' | 'auto'): MapProvider {
    if (requestedProvider && requestedProvider !== 'auto') {
      return {
        name: requestedProvider,
        type: requestedProvider === 'google' ? 'streetview' : 'streetside',
        isAvailable: !this.isCircuitBreakerOpen(requestedProvider)
      };
    }

    // Use primary provider if circuit breaker is closed
    if (!this.isCircuitBreakerOpen(this.config.primaryProvider.name)) {
      return this.config.primaryProvider;
    }

    // Fall back to secondary provider if available
    if (this.config.fallbackProvider && !this.isCircuitBreakerOpen(this.config.fallbackProvider.name)) {
      return this.config.fallbackProvider;
    }

    // Return primary even if circuit breaker is open (will fail gracefully)
    return this.config.primaryProvider;
  }

  /**
   * Attempt to get panorama from specific provider
   */
  private async attemptProvider(
    provider: 'google' | 'bing', 
    request: UnifiedPanoramaRequest, 
    startTime: number
  ): Promise<UnifiedPanoramaResponse> {
    
    if (this.isCircuitBreakerOpen(provider)) {
      throw new Error(`Circuit breaker open for ${provider} provider`);
    }

    try {
      if (provider === 'google') {
        return await this.getGooglePanorama(request, startTime);
      } else {
        return await this.getBingPanorama(request, startTime);
      }
    } catch (error) {
      this.recordFailure(provider);
      throw error;
    }
  }

  /**
   * Get panorama from Google Street View
   */
  private async getGooglePanorama(request: UnifiedPanoramaRequest, startTime: number): Promise<UnifiedPanoramaResponse> {
    const googleParams: any = {
      lat: request.lat,
      lng: request.lng,
      size: request.size || '480x480'
    };

    if (request.heading !== undefined) googleParams.heading = request.heading;
    if (request.pitch !== undefined) googleParams.pitch = request.pitch;
    if (request.fov !== undefined) googleParams.fov = request.fov;

    const imageUrl = this.googleService.buildStreetViewUrl(googleParams);

    return {
      imageUrl,
      provider: 'google',
      metadata: {
        lat: request.lat,
        lng: request.lng,
        heading: request.heading || 0,
        pitch: request.pitch || 0,
        fov: request.fov || 90,
        size: request.size || '480x480',
        cached: false,
        responseTime: Date.now() - startTime
      },
      success: true,
      error: undefined
    };
  }

  /**
   * Get panorama from Bing Maps Streetside
   */
  private async getBingPanorama(request: UnifiedPanoramaRequest, startTime: number): Promise<UnifiedPanoramaResponse> {
    const bingParams: any = {
      lat: request.lat,
      lng: request.lng,
      size: request.size || '480x480'
    };

    if (request.heading !== undefined) bingParams.heading = request.heading;
    if (request.pitch !== undefined) bingParams.pitch = request.pitch;
    if (request.fov !== undefined) bingParams.fov = request.fov;

    const result = await this.bingService.getStreetViewUrl(bingParams);

    return {
      imageUrl: result.imageUrl,
      provider: 'bing',
      metadata: {
        lat: request.lat,
        lng: request.lng,
        heading: result.metadata.calculatedBearing,
        pitch: request.pitch || 0,
        fov: request.fov || 90,
        size: request.size || '480x480',
        cached: false,
        responseTime: Date.now() - startTime
      },
      success: result.success,
      error: result.error || undefined
    };
  }

  /**
   * Initialize health check monitoring
   */
  private initializeHealthChecks(): void {
    // Initialize health status for both providers
    this.healthStatus.set('google', {
      provider: 'google',
      isHealthy: true,
      lastCheck: new Date(),
      responseTime: 0,
      errorCount: 0,
      successRate: 100
    });

    this.healthStatus.set('bing', {
      provider: 'bing',
      isHealthy: true,
      lastCheck: new Date(),
      responseTime: 0,
      errorCount: 0,
      successRate: 100
    });

    // Initialize circuit breakers
    this.circuitBreaker.set('google', { isOpen: false, lastFailure: new Date(0), failureCount: 0 });
    this.circuitBreaker.set('bing', { isOpen: false, lastFailure: new Date(0), failureCount: 0 });

    // Start periodic health checks
    setInterval(() => this.performHealthChecks(), this.config.healthCheckInterval);
  }

  /**
   * Perform periodic health checks
   */
  private async performHealthChecks(): Promise<void> {
    for (const provider of ['google', 'bing'] as const) {
      try {
        const isHealthy = await this.testProvider(provider);
        const status = this.healthStatus.get(provider);
        
        if (status) {
          status.isHealthy = isHealthy;
          status.lastCheck = new Date();
          
          if (isHealthy) {
            this.resetCircuitBreaker(provider);
          }
        }
      } catch (error) {
        console.error(`Health check failed for ${provider}:`, error);
      }
    }
  }

  /**
   * Update provider health status
   */
  private updateHealthStatus(provider: 'google' | 'bing', success: boolean, responseTime: number): void {
    const status = this.healthStatus.get(provider);
    if (!status) return;

    status.lastCheck = new Date();
    status.responseTime = responseTime;
    
    if (success) {
      status.successRate = Math.min(100, status.successRate + 1);
      status.isHealthy = true;
    } else {
      status.errorCount++;
      status.successRate = Math.max(0, status.successRate - 5);
      status.isHealthy = status.successRate > 50;
    }
  }

  /**
   * Check if circuit breaker is open for provider
   */
  private isCircuitBreakerOpen(provider: 'google' | 'bing'): boolean {
    const breaker = this.circuitBreaker.get(provider);
    if (!breaker) return false;

    // Auto-reset circuit breaker after 5 minutes
    if (breaker.isOpen && Date.now() - breaker.lastFailure.getTime() > 300000) {
      breaker.isOpen = false;
      breaker.failureCount = 0;
    }

    return breaker.isOpen;
  }

  /**
   * Record failure and potentially open circuit breaker
   */
  private recordFailure(provider: 'google' | 'bing'): void {
    const breaker = this.circuitBreaker.get(provider);
    if (!breaker) return;

    breaker.failureCount++;
    breaker.lastFailure = new Date();

    // Open circuit breaker after 5 consecutive failures
    if (breaker.failureCount >= 5) {
      breaker.isOpen = true;
    }
  }

  /**
   * Reset circuit breaker on successful request
   */
  private resetCircuitBreaker(provider: 'google' | 'bing'): void {
    const breaker = this.circuitBreaker.get(provider);
    if (breaker) {
      breaker.isOpen = false;
      breaker.failureCount = 0;
    }
  }

  /**
   * Get placeholder URL for failed requests
   */
  private getPlaceholderUrl(request: UnifiedPanoramaRequest): string {
    const size = request.size || '480x480';
    return `https://via.placeholder.com/${size}/cccccc/666666?text=Street+View+Unavailable`;
  }

  /**
   * Sanitize request for logging (remove sensitive data)
   */
  private sanitizeRequest(request: UnifiedPanoramaRequest): any {
    return {
      lat: request.lat,
      lng: request.lng,
      size: request.size,
      heading: request.heading,
      pitch: request.pitch,
      fov: request.fov,
      provider: request.provider
    };
  }
}

export const mapProviderService = MapProviderService.getInstance();
