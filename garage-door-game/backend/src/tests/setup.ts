import { initializeDatabase } from '../config/database';

// Mock environment variables for testing
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:'; // Use in-memory database for tests
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.GOOGLE_STREET_VIEW_API_KEY = 'AIzaTest-mock-api-key-for-testing';
process.env.GOOGLE_MAPS_API_KEY = 'AIzaTest-mock-api-key-for-testing';

// Mock Google API service
jest.mock('../services/googleApiService', () => ({
  googleApiService: {
    buildStreetViewUrl: jest.fn(() => 'https://mock-streetview-url.com/test.jpg'),
    getRandomAddress: jest.fn(() => ({
      lat: 37.7749,
      lng: -122.4194,
      address: '123 Test Street, Test City, TC 12345'
    })),
    validateApiKey: jest.fn(() => true),
    getUsageStats: jest.fn(() => ({
      streetViewRequests: 0,
      mapsRequests: 0,
      dailyLimit: 1000
    }))
  },
  googleApiLimiter: jest.fn((req: any, res: any, next: any) => next())
}));

// Mock computer vision service
jest.mock('../services/computerVisionService', () => ({
  analyzeGarageDoors: jest.fn(() => ({
    garageCount: 2,
    garageWidth: 8,
    garageHeight: 7,
    garageType: 'residential',
    confidence: 85
  }))
}));

// Mock Google API middleware
jest.mock('../middleware/googleApiSecurity', () => ({
  checkGoogleApiLimits: jest.fn((req: any, res: any, next: any) => next()),
  validateGoogleApiConfig: jest.fn((req: any, res: any, next: any) => next()),
  logGoogleApiUsage: jest.fn(() => (req: any, res: any, next: any) => next())
}));

// Mock rate limiting middleware
jest.mock('express-rate-limit', () => {
  return jest.fn(() => (req: any, res: any, next: any) => next());
});

// Mock game service
jest.mock('../services/gameService', () => ({
  createGameSession: jest.fn(() => ({
    sessionId: 'test-session-id',
    userId: 1,
    imageUrl: 'https://mock-streetview-url.com/test.jpg',
    difficulty: 'medium',
    timeLimit: 30,
    startTime: new Date(),
    correctAnswer: {
      garageCount: 2,
      garageWidth: 8,
      garageHeight: 7,
      garageType: 'residential'
    }
  })),
  getGameSession: jest.fn(() => ({
    sessionId: 'test-session-id',
    userId: 1,
    imageUrl: 'https://mock-streetview-url.com/test.jpg',
    difficulty: 'medium',
    timeLimit: 30,
    startTime: new Date(),
    correctAnswer: {
      garageCount: 2,
      garageWidth: 8,
      garageHeight: 7,
      garageType: 'residential'
    }
  })),
  updateGameSession: jest.fn(),
  calculateScore: jest.fn(() => ({
    score: 85,
    accuracy: 90,
    pointsEarned: 100,
    correctAnswer: {
      garageCount: 2,
      garageWidth: 8,
      garageHeight: 7,
      garageType: 'residential'
    }
  })),
  getUserGameHistory: jest.fn(() => ({
    games: [],
    totalGames: 0,
    averageScore: 0
  })),
  updateUserStats: jest.fn(),
  generateRandomLocation: jest.fn(() => ({
    lat: 37.7749,
    lng: -122.4194,
    address: '123 Test Street, Test City, TC 12345'
  })),
  getTimeLimitForDifficulty: jest.fn(() => 30)
}));

// Global test setup
beforeAll(async () => {
  await initializeDatabase();
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
