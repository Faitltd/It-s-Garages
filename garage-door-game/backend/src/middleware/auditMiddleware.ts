import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../utils/auth';
import { auditLogger } from '../services/auditLogger';

/**
 * Middleware to log all API requests
 */
export const auditApiRequests = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  // Override res.send to capture response
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const success = res.statusCode >= 200 && res.statusCode < 400;
    
    // Skip health check and static file requests from audit logs
    if (!req.path.includes('/health') && !req.path.includes('/uploads')) {
      auditLogger.logApiAccess(
        req as AuthenticatedRequest,
        req.path,
        req.method,
        success,
        {
          statusCode: res.statusCode,
          duration,
          contentLength: res.get('Content-Length'),
          query: Object.keys(req.query).length > 0 ? req.query : undefined,
          body: req.method !== 'GET' && req.body ? sanitizeRequestBody(req.body) : undefined
        },
        success ? undefined : `HTTP ${res.statusCode}`
      );
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Middleware to log authentication events
 */
export const auditAuthEvents = (event: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      auditLogger.logAuth(
        req as AuthenticatedRequest,
        event,
        success,
        {
          statusCode: res.statusCode,
          email: req.body?.email ? maskEmail(req.body.email) : undefined,
          username: req.body?.username
        },
        success ? undefined : `Authentication failed with status ${res.statusCode}`
      );
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Middleware to log data access events
 */
export const auditDataAccess = (resource: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      auditLogger.logDataAccess(
        req as AuthenticatedRequest,
        resource,
        action,
        req.params?.id || req.body?.id,
        success,
        {
          statusCode: res.statusCode,
          params: req.params,
          query: req.query
        }
      );
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Middleware to detect and log suspicious activity
 */
export const detectSuspiciousActivity = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    // SQL injection attempts
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
    // XSS attempts
    /<script[^>]*>.*?<\/script>/gi,
    // Path traversal attempts
    /\.\.[\/\\]/,
    // Command injection attempts
    /[;&|`$(){}[\]]/
  ];
  
  const checkForSuspiciousContent = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(obj));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => checkForSuspiciousContent(value));
    }
    
    return false;
  };
  
  // Check query parameters, body, and headers
  const suspicious = 
    checkForSuspiciousContent(req.query) ||
    checkForSuspiciousContent(req.body) ||
    checkForSuspiciousContent(req.headers);
  
  if (suspicious) {
    auditLogger.logSecurity(
      req as AuthenticatedRequest,
      'suspicious_request',
      {
        path: req.path,
        method: req.method,
        query: req.query,
        body: sanitizeRequestBody(req.body),
        headers: sanitizeHeaders(req.headers)
      },
      'Suspicious patterns detected in request'
    );
  }
  
  next();
};

/**
 * Middleware to log failed authentication attempts
 */
export const logFailedAuth = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 401 || res.statusCode === 403) {
      auditLogger.logSecurity(
        req as AuthenticatedRequest,
        'failed_authentication',
        {
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          email: req.body?.email ? maskEmail(req.body.email) : undefined
        },
        `Authentication failed with status ${res.statusCode}`
      );
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Sanitize request body for logging (remove sensitive data)
 */
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'confirmPassword', 'currentPassword', 'newPassword', 'token', 'refreshToken'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * Sanitize headers for logging (remove sensitive data)
 */
function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * Mask email for logging (show first char and domain)
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '[INVALID_EMAIL]';
  
  return `${local[0]}***@${domain}`;
}
