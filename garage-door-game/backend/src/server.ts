console.log('🔄 Starting server initialization...');

import dotenv from 'dotenv';

console.log('🔄 Loading environment variables...');
// Load environment variables
dotenv.config();
console.log('✅ Environment variables loaded');

// Database will be imported dynamically later to avoid blocking startup

console.log('🔄 Importing app module...');
import { createApp } from './app';
console.log('✅ App module imported');

const app = createApp();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Initialize database and start server
const startServer = async () => {
  try {
    console.log('🔄 Starting server initialization...');
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔌 Port: ${PORT}`);
    console.log(`🗄️ Database URL: ${process.env.DATABASE_URL || 'Not set'}`);

    // Start HTTP server first so Cloud Run sees the port quickly
    console.log('🔄 Starting HTTP server...');
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Garage Door Game API Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
      console.log(`📁 Upload Path: ${process.env.UPLOAD_PATH || './uploads'}`);
      console.log(`🎯 Health Check: http://0.0.0.0:${PORT}/health`);
      console.log(`📖 API Info: http://0.0.0.0:${PORT}/api`);
      console.log('✅ Server startup complete');
    });

    // Initialize database asynchronously (do not block port readiness)
    console.log('🔄 Initializing database (async)...');
    import('./config/database')
      .then(({ initializeDatabase, db }) => {
        // Wire DB into lazy accessor for routes
        return import('./config/dbAccessor').then(({ setDb }) => {
          setDb(db);
          return initializeDatabase();
        });
      })
      .then(() => console.log('✅ Database initialized successfully'))
      .catch((err) => {
        console.error('❌ Database initialization failed (continuing to serve non-DB endpoints):', err);
      });

    server.on('error', (error: any) => {
      console.error('❌ Server error:', error);
      if ((error as any).code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      }
      // Do not exit immediately; let Cloud Run restart if needed
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (error instanceof Error) {
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
    }
    // Avoid immediate exit to allow Cloud Run to capture logs
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();

export default app;
