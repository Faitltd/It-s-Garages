import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, verifyToken, extractTokenFromHeader } from '../utils/auth';
import { createError } from './errorHandler';

// Re-export AuthenticatedRequest for convenience
export { AuthenticatedRequest } from '../utils/auth';

/**
 * Authentication middleware - verifies JWT token
 */
export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return next(createError('Access denied. No token provided.', 401));
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Token expired') {
        return next(createError('Token expired. Please login again.', 401));
      } else if (error.message === 'Invalid token') {
        return next(createError('Invalid token. Please login again.', 401));
      }
    }
    return next(createError('Authentication failed.', 401));
  }
};

/**
 * Authorization middleware - checks user roles
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createError('Access denied. Authentication required.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(createError('Access denied. Insufficient permissions.', 403));
    }

    next();
  };
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      const decoded = verifyToken(token);
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

/**
 * Admin only middleware
 */
export const adminOnly = authorize('admin');

/**
 * User or admin middleware
 */
export const userOrAdmin = authorize('user', 'admin');
