import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import jobRoutes from './routes/jobs';
import dataRoutes from './routes/data';
import estimateRoutes from './routes/estimate';
import dataEntryRoutes from './routes/dataEntry';
import testRoutes from './routes/test';
import streetViewRoutes from './routes/streetView';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { auditApiRequests, detectSuspiciousActivity, logFailedAuth } from './middleware/auditMiddleware';

export const createApp = () => {
  const app = express();

  // Trust proxy for Cloud Run (fixes rate limiting issues)
  app.set('trust proxy', true);

  // Enhanced security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://maps.googleapis.com", "https://streetviewpixels-pa.googleapis.com"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https://maps.googleapis.com"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'"]
      }
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false, // Allow Google Maps embedding
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  }));

  // CORS configuration - Allow all origins for now to debug
  const allowedOrigins = [
    'http://localhost:5173', // Development
    'https://itsgarages.itsfait.com', // Production custom domain
    'https://garage-door-frontend-341270520862.us-central1.run.app', // Cloud Run frontend
    'http://localhost:3000', // Local development
    'http://localhost:4173', // Vite preview
    'https://localhost:5173' // HTTPS local development
  ];

  app.use(cors({
    origin: (origin, callback) => {
      console.log('🔍 CORS Request from origin:', origin);

      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        console.log('✅ Allowing request with no origin');
        return callback(null, true);
      }

      // Check if the origin is in our allowed list
      if (allowedOrigins.includes(origin)) {
        console.log('✅ Origin allowed:', origin);
        return callback(null, true);
      }

      // If CORS_ORIGIN is set, use it as a fallback
      if (process.env.CORS_ORIGIN && origin === process.env.CORS_ORIGIN) {
        console.log('✅ Origin allowed via CORS_ORIGIN env var:', origin);
        return callback(null, true);
      }

      console.log('❌ Origin not allowed:', origin);
      console.log('📋 Allowed origins:', allowedOrigins);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  }));

  // Cache-busting headers for all API requests to prevent browser caching issues
  app.use((req, res, next) => {
    // Add cache-busting headers for all API responses
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    next();
  });

  // Rate limiting disabled for Cloud Run compatibility
  // TODO: Implement proper rate limiting with Cloud Run proxy support

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Cookie parsing middleware
  app.use(cookieParser());

  // Logging middleware
  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // Security and audit middleware (skip in test environment)
  if (process.env.NODE_ENV !== 'test') {
    app.use(detectSuspiciousActivity);
    app.use(auditApiRequests);
    app.use(logFailedAuth);
  }

  // Serve static files (uploaded images)
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  // Root endpoint
  app.get('/', (req, res) => {
    res.status(200).json({
      name: 'Garage Door Game API',
      status: 'running',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      endpoints: {
        health: '/health',
        api: '/api',
        validationGame: '/api/validation-game'
      }
    });
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });
  });

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/data', dataRoutes);
  app.use('/api/estimate', estimateRoutes);
  app.use('/api/data-entry', dataEntryRoutes);
  app.use('/api/test', testRoutes);
  app.use('/api/streetview', streetViewRoutes);

  // API info endpoint
  app.get('/api', (req, res) => {
    const apiKeyConfigured = process.env.GOOGLE_STREET_VIEW_API_KEY &&
                            process.env.GOOGLE_STREET_VIEW_API_KEY !== 'your-google-street-view-api-key' &&
                            process.env.GOOGLE_STREET_VIEW_API_KEY.startsWith('AIza');

    res.json({
      name: 'Garage Door Game API',
      version: '1.0.0',
      description: 'Backend API for the Garage Door Data Collection Game - Production Mode (Google API Required)',
      endpoints: {
        auth: '/api/auth',
        users: '/api/users',
        jobs: '/api/jobs',
        game: '/api/game',
        leaderboard: '/api/leaderboard',
        data: '/api/data',
        estimate: '/api/estimate',
        test: '/api/test'
      },
      streetView: {
        status: apiKeyConfigured ? 'ready' : 'error',
        message: apiKeyConfigured ?
          'Google Street View API is configured and ready' :
          'ERROR: Google API key is required. Demo mode has been disabled. Please configure your Google Street View API key.'
      },
      testPages: {
        streetViewTest: '/test-streetview',
        setupGuide: 'See setup-google-api.md for configuration instructions'
      },
      documentation: 'https://github.com/Faitltd/garage-door-game'
    });
  });

  // Test endpoint for Street View URL generation
  app.get('/api/test/streetview', async (req, res) => {
    try {
      const { GoogleApiService } = require('./services/googleApiService');
      const googleApiService = new GoogleApiService();

      // Test coordinates (Residential address in San Francisco)
      const testLat = 37.7749;
      const testLng = -122.4194;

      const streetViewUrl = await googleApiService.buildOptimalStreetViewUrl({
        lat: testLat,
        lng: testLng,
        size: '640x640',
        pitch: 10, // Slightly upward to capture house fronts and garage doors
        fov: 90,
        preferredSide: 'right' // Default to right side for testing
      });

      res.json({
        success: true,
        testLocation: {
          lat: testLat,
          lng: testLng,
          address: '753 Redwood Lane, San Francisco, CA'
        },
        streetViewUrl: streetViewUrl,
        isPlaceholder: false,
        apiKeyConfigured: true,
        message: 'Using real Google Street View API'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Google Street View API key is required. Please configure your API key in the .env file.'
      });
    }
  });

  // Serve test HTML page
  app.get('/test-streetview', (req, res) => {
    const fs = require('fs');
    const path = require('path');

    try {
      const htmlPath = path.join(__dirname, '../../test-streetview.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(404).send('Test page not found');
    }
  });

  // Error handling middleware (must be last)
  app.use(notFound);
  app.use(errorHandler);

  return app;
};

export default createApp();
