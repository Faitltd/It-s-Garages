export const testUsers = {
  validUser: {
    username: 'testuser',
    email: 'test@example.com',
    password: 'TestPassword123!',
    confirmPassword: 'TestPassword123!'
  },
  adminUser: {
    username: 'admin',
    email: 'admin@example.com',
    password: 'AdminPassword123!',
    confirmPassword: 'AdminPassword123!'
  },
  invalidUsers: {
    weakPassword: {
      username: 'testuser',
      email: 'test@example.com',
      password: '123',
      confirmPassword: '123'
    },
    invalidEmail: {
      username: 'testuser',
      email: 'invalid-email',
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!'
    },
    mismatchedPasswords: {
      username: 'testuser',
      email: 'test@example.com',
      password: 'TestPassword123!',
      confirmPassword: 'DifferentPassword123!'
    }
  }
};

export const testGameData = {
  gameSession: {
    sessionId: 'test-session-123',
    userId: 1,
    imageUrl: 'https://example.com/test-image.jpg',
    difficulty: 'medium',
    timeLimit: 30,
    startTime: new Date(),
    correctAnswer: {
      garageCount: 2,
      garageWidth: 8,
      garageHeight: 7,
      garageType: 'residential'
    }
  },
  validGuess: {
    sessionId: 'test-session-123',
    garageCount: 2,
    garageWidth: 8,
    garageHeight: 7,
    garageType: 'residential',
    confidence: 85
  },
  invalidGuess: {
    sessionId: 'invalid-session',
    garageCount: 0,
    confidence: -10
  }
};

export const testDataSubmissions = {
  validSubmission: {
    address: '123 Test Street, Test City, TC 12345',
    doors: [
      { size: '8x7 feet' },
      { size: '9x8 feet' }
    ]
  },
  invalidSubmissions: {
    noAddress: {
      doors: [{ size: '8x7 feet' }]
    },
    noDoors: {
      address: '123 Test Street'
    },
    emptyDoors: {
      address: '123 Test Street',
      doors: []
    },
    invalidDoorSize: {
      address: '123 Test Street',
      doors: [{ size: '' }]
    }
  }
};

export const mockApiResponses = {
  streetViewUrl: 'https://mock-streetview-url.com/test.jpg',
  randomAddress: {
    lat: 37.7749,
    lng: -122.4194,
    address: '123 Test Street, Test City, TC 12345'
  },
  computerVisionResult: {
    garageCount: 2,
    garageWidth: 8,
    garageHeight: 7,
    garageType: 'residential',
    confidence: 85
  },
  gameScore: {
    score: 85,
    accuracy: 90,
    pointsEarned: 100,
    correctAnswer: {
      garageCount: 2,
      garageWidth: 8,
      garageHeight: 7,
      garageType: 'residential'
    }
  }
};

export const testJWTTokens = {
  validToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTYzMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.test-signature',
  expiredToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTYzMDAwMDAwMCwiZXhwIjoxNjMwMDAwMDAxfQ.expired-signature',
  invalidToken: 'invalid.token.signature'
};

export const testErrorMessages = {
  auth: {
    invalidCredentials: 'Invalid email or password',
    tokenExpired: 'Token expired. Please login again.',
    tokenInvalid: 'Invalid token. Please login again.',
    noToken: 'Access denied. No token provided.',
    weakPassword: 'Password must be at least 8 characters long',
    invalidEmail: 'Please provide a valid email address',
    passwordMismatch: 'Passwords do not match',
    emailExists: 'Email already exists'
  },
  game: {
    sessionNotFound: 'Game session not found',
    sessionExpired: 'Game session has expired',
    invalidGuess: 'Invalid guess data',
    gameAlreadyCompleted: 'Game session has already been completed'
  },
  data: {
    addressRequired: 'Address and at least one door size are required',
    invalidDoorSize: 'Each door must have a valid size',
    authRequired: 'Authentication required. Please log in.'
  },
  general: {
    networkError: 'Network error. Please try again.',
    serverError: 'Internal server error',
    validationError: 'Validation failed'
  }
};
