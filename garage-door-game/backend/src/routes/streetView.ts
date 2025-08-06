import express, { Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { streetViewService } from '../services/streetViewService';
import { googleApiLimiter } from '../services/googleApiService';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// Apply rate limiting to all Street View routes
router.use(googleApiLimiter);

/**
 * GET /api/streetview/home
 * Get optimized Street View image for a residential address
 */
router.get('/home', [
  query('address')
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be between 5 and 200 characters'),
  query('size')
    .optional()
    .matches(/^\d+x\d+$/)
    .withMessage('Size must be in format WIDTHxHEIGHT (e.g., 600x400)'),
  query('heading')
    .optional()
    .isFloat({ min: 0, max: 360 })
    .withMessage('Heading must be between 0 and 360 degrees'),
  query('pitch')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Pitch must be between -90 and 90 degrees'),
  query('fov')
    .optional()
    .isFloat({ min: 10, max: 120 })
    .withMessage('Field of view must be between 10 and 120 degrees')
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { address, size, heading, pitch, fov } = req.query;

    const options: any = {};
    if (size) options.size = size as string;
    if (heading) options.heading = parseFloat(heading as string);
    if (pitch) options.pitch = parseFloat(pitch as string);
    if (fov) options.fov = parseFloat(fov as string);

    const result = await streetViewService.getHomeStreetViewUrl(address as string, options);

    return res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('Street View API error:', error);
    
    // Handle specific error types
    if (error.message.includes('Not a residential address')) {
      return res.status(400).json({
        success: false,
        error: 'Address does not appear to be residential',
        message: error.message
      });
    }
    
    if (error.message.includes('not appear to be in a residential area')) {
      return res.status(400).json({
        success: false,
        error: 'Address is not in a residential area',
        message: error.message
      });
    }
    
    if (error.message.includes('building footprint not found')) {
      return res.status(404).json({
        success: false,
        error: 'Building not found',
        message: 'Could not locate building footprint for this address'
      });
    }
    
    if (error.message.includes('Street View not available')) {
      return res.status(404).json({
        success: false,
        error: 'Street View unavailable',
        message: 'Google Street View is not available for this location'
      });
    }

    return next(error);
  }
});

/**
 * GET /api/streetview/flexible
 * Get Street View image with fallback for non-residential or missing building data
 */
router.get('/flexible', [
  query('address')
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be between 5 and 200 characters'),
  query('size')
    .optional()
    .matches(/^\d+x\d+$/)
    .withMessage('Size must be in format WIDTHxHEIGHT (e.g., 600x400)'),
  query('heading')
    .optional()
    .isFloat({ min: 0, max: 360 })
    .withMessage('Heading must be between 0 and 360 degrees'),
  query('pitch')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Pitch must be between -90 and 90 degrees'),
  query('fov')
    .optional()
    .isFloat({ min: 10, max: 120 })
    .withMessage('Field of view must be between 10 and 120 degrees')
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { address, size, heading, pitch, fov } = req.query;

    const options: any = {};
    if (size) options.size = size as string;
    if (heading) options.heading = parseFloat(heading as string);
    if (pitch) options.pitch = parseFloat(pitch as string);
    if (fov) options.fov = parseFloat(fov as string);

    const result = await streetViewService.getFlexibleHomeStreetView(address as string, options);

    return res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('Flexible Street View API error:', error);
    return next(error);
  }
});

/**
 * GET /api/streetview/multi-angle
 * Get multiple Street View angles for a single address
 */
router.get('/multi-angle', [
  query('address')
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be between 5 and 200 characters'),
  query('angles')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        const angles = value.split(',').map(a => parseFloat(a.trim()));
        if (angles.some(a => isNaN(a) || a < 0 || a >= 360)) {
          throw new Error('All angles must be numbers between 0 and 360');
        }
        if (angles.length > 8) {
          throw new Error('Maximum 8 angles allowed');
        }
      }
      return true;
    })
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { address, angles } = req.query;

    let angleArray = [0, 90, 180, 270]; // Default angles
    if (angles && typeof angles === 'string') {
      angleArray = angles.split(',').map(a => parseFloat(a.trim()));
    }

    const result = await streetViewService.getMultiAngleStreetView(address as string, angleArray);

    return res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('Multi-angle Street View API error:', error);
    return next(error);
  }
});

/**
 * GET /api/streetview/health
 * Health check endpoint for Street View service
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'Street View Service',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

export default router;
