import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import jobRoutes from './routes/jobs';
import gameRoutes from './routes/game';
import leaderboardRoutes from './routes/leaderboard';
import dataRoutes from './routes/data';
import estimateRoutes from './routes/estimate';
import dataEntryRoutes from './routes/dataEntry';
import validationGameRoutes from './routes/validationGame';
import testRoutes from './routes/testRoutes';

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

  // CORS configuration
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

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
  app.use('/api/game', gameRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/data', dataRoutes);
  app.use('/api/estimate', estimateRoutes);
  app.use('/api/data-entry', dataEntryRoutes);
  app.use('/api/validation-game', validationGameRoutes);
  app.use('/api/test', testRoutes);

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
  app.get('/api/test/streetview', (req, res) => {
    try {
      const { googleApiService } = require('./services/googleApiService');

      // Test coordinates (Residential address in San Francisco)
      const testLat = 37.7749;
      const testLng = -122.4194;

      const streetViewUrl = googleApiService.buildStreetViewUrl({
        lat: testLat,
        lng: testLng,
        size: '640x640',
        heading: 45, // Angled view to better show house and garage
        pitch: -10, // Slightly downward to capture garage doors
        fov: 90
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
