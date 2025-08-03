import { Request, Response, NextFunction } from 'express';
import { googleApiService } from '../services/googleApiService';
import { createError } from './errorHandler';

/**
 * Middleware to check Google API usage limits
 */
export const checkGoogleApiLimits = (req: Request, res: Response, next: NextFunction) => {
  try {
    const usage = googleApiService.getUsageStats();
    const totalRequests = usage.streetViewRequests + usage.mapsRequests;
    
    if (totalRequests >= usage.dailyLimit) {
      return next(createError('Daily Google API limit exceeded. Please try again tomorrow.', 429));
    }
    
    // Add usage info to response headers for monitoring
    res.set({
      'X-API-Usage-Street-View': usage.streetViewRequests.toString(),
      'X-API-Usage-Maps': usage.mapsRequests.toString(),
      'X-API-Usage-Total': totalRequests.toString(),
      'X-API-Usage-Limit': usage.dailyLimit.toString(),
      'X-API-Usage-Remaining': (usage.dailyLimit - totalRequests).toString()
    });
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate Google API configuration
 */
export const validateGoogleApiConfig = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if API keys are configured
    if (!process.env.GOOGLE_STREET_VIEW_API_KEY) {
      return next(createError('Google Street View API key not configured', 500));
    }
    
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return next(createError('Google Maps API key not configured', 500));
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to log Google API usage for audit purposes
 */
export const logGoogleApiUsage = (apiType: 'streetView' | 'maps') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log API usage after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`[AUDIT] Google ${apiType} API used by IP: ${req.ip}, User-Agent: ${req.get('User-Agent')}, Timestamp: ${new Date().toISOString()}`);
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};
