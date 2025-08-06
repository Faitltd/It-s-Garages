/**
 * Security Service - Zero Trust Implementation
 * Handles secure API key management, audit logging, and security controls
 */

import crypto from 'crypto';
import { AuditLogger } from './auditLogger';

export interface SecurityConfig {
  provider: 'google' | 'bing' | 'hybrid';
  enableFallback: boolean;
  maxRetries: number;
  auditLevel: 'basic' | 'detailed' | 'comprehensive';
}

export interface ApiKeyValidation {
  isValid: boolean;
  provider: string;
  keyType: string;
  lastValidated: Date;
  usageCount: number;
  errorCount: number;
}

export class SecurityService {
  private static instance: SecurityService;
  private auditLogger: AuditLogger;
  private keyValidationCache: Map<string, ApiKeyValidation> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  private constructor() {
    this.auditLogger = new AuditLogger();
  }

  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  /**
   * Secure API key retrieval with validation and audit logging
   */
  public async getSecureApiKey(provider: 'google' | 'bing', keyType: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Get environment variable name
      const envVarName = this.getEnvVarName(provider, keyType);
      const apiKey = process.env[envVarName];

      // Validate key exists and is not placeholder
      if (!apiKey || this.isPlaceholderKey(apiKey)) {
        await this.auditLogger.logSecurityEvent({
          event: 'API_KEY_MISSING',
          provider,
          keyType,
          severity: 'HIGH',
          timestamp: new Date(),
          details: { envVarName }
        });
        throw new Error(`${provider} ${keyType} API key not configured`);
      }

      // Validate key format
      if (!this.validateKeyFormat(provider, keyType, apiKey)) {
        await this.auditLogger.logSecurityEvent({
          event: 'API_KEY_INVALID_FORMAT',
          provider,
          keyType,
          severity: 'HIGH',
          timestamp: new Date(),
          details: { keyLength: apiKey.length }
        });
        throw new Error(`Invalid ${provider} ${keyType} API key format`);
      }

      // Check cache for recent validation
      const cacheKey = this.generateCacheKey(provider, keyType, apiKey);
      const cached = this.keyValidationCache.get(cacheKey);
      
      if (cached && this.isCacheValid(cached)) {
        cached.usageCount++;
        await this.auditLogger.logApiUsage({
          provider,
          keyType,
          usageCount: cached.usageCount,
          responseTime: Date.now() - startTime,
          cached: true
        });
        return apiKey;
      }

      // Validate key with provider (rate-limited)
      const validation = await this.validateKeyWithProvider(provider, keyType, apiKey);
      
      // Update cache
      this.keyValidationCache.set(cacheKey, {
        ...validation,
        lastValidated: new Date(),
        usageCount: 1,
        errorCount: 0
      });

      await this.auditLogger.logApiUsage({
        provider,
        keyType,
        usageCount: 1,
        responseTime: Date.now() - startTime,
        cached: false,
        validated: validation.isValid
      });

      return apiKey;

    } catch (error) {
      await this.auditLogger.logSecurityEvent({
        event: 'API_KEY_RETRIEVAL_FAILED',
        provider,
        keyType,
        severity: 'HIGH',
        timestamp: new Date(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  /**
   * Get security configuration from environment
   */
  public getSecurityConfig(): SecurityConfig {
    return {
      provider: (process.env.MAP_PROVIDER as 'google' | 'bing' | 'hybrid') || 'bing',
      enableFallback: process.env.ENABLE_PROVIDER_FALLBACK === 'true',
      maxRetries: parseInt(process.env.MAX_API_RETRIES || '3'),
      auditLevel: (process.env.AUDIT_LEVEL as 'basic' | 'detailed' | 'comprehensive') || 'detailed'
    };
  }

  /**
   * Sanitize sensitive data for logging
   */
  public sanitizeForLogging(data: any): any {
    if (typeof data === 'string') {
      // Mask API keys
      if (data.length > 10) {
        return data.substring(0, 4) + '*'.repeat(data.length - 8) + data.substring(data.length - 4);
      }
      return '*'.repeat(data.length);
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (this.isSensitiveField(key)) {
          sanitized[key] = this.sanitizeForLogging(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Generate secure hash for cache keys
   */
  private generateCacheKey(provider: string, keyType: string, apiKey: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(`${provider}:${keyType}:${apiKey}`);
    return hash.digest('hex');
  }

  /**
   * Check if cached validation is still valid
   */
  private isCacheValid(cached: ApiKeyValidation): boolean {
    const now = Date.now();
    const lastValidated = cached.lastValidated.getTime();
    return (now - lastValidated) < this.CACHE_TTL && cached.errorCount < 3;
  }

  /**
   * Get environment variable name for API key
   */
  private getEnvVarName(provider: 'google' | 'bing', keyType: string): string {
    if (provider === 'google') {
      return keyType === 'streetview' ? 'GOOGLE_STREET_VIEW_API_KEY' : 'GOOGLE_MAPS_API_KEY';
    } else {
      return 'BING_MAPS_API_KEY';
    }
  }

  /**
   * Check if key is a placeholder value
   */
  private isPlaceholderKey(key: string): boolean {
    const placeholders = [
      'your-api-key-here',
      'your-google-maps-api-key',
      'your-google-street-view-api-key',
      'your-bing-maps-api-key',
      'placeholder',
      'test-key'
    ];
    return placeholders.includes(key.toLowerCase()) || key.length < 10;
  }

  /**
   * Validate API key format based on provider
   */
  private validateKeyFormat(provider: 'google' | 'bing', keyType: string, key: string): boolean {
    if (provider === 'google') {
      // Google API keys are typically 39 characters, alphanumeric with hyphens and underscores
      return /^[A-Za-z0-9_-]{35,45}$/.test(key);
    } else {
      // Bing Maps keys are typically 64 characters, alphanumeric
      return /^[A-Za-z0-9]{60,70}$/.test(key);
    }
  }

  /**
   * Validate key with provider (rate-limited)
   */
  private async validateKeyWithProvider(provider: 'google' | 'bing', keyType: string, key: string): Promise<ApiKeyValidation> {
    // Implement actual validation logic here
    // For now, return basic validation based on format
    return {
      isValid: this.validateKeyFormat(provider, keyType, key),
      provider,
      keyType,
      lastValidated: new Date(),
      usageCount: 0,
      errorCount: 0
    };
  }

  /**
   * Check if field contains sensitive data
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'key', 'apikey', 'api_key', 'token', 'secret', 'password', 'pass',
      'auth', 'authorization', 'credential', 'private'
    ];
    return sensitiveFields.some(field => fieldName.toLowerCase().includes(field));
  }
}

export const securityService = SecurityService.getInstance();
