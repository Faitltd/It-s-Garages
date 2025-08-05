import request from 'supertest';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createApp } from '../app';
import './setup';

const app = createApp();

describe('Game API', () => {
  let authToken: string;
  let testUser = {
    username: 'gameuser',
    email: 'game@example.com',
    password: 'TestPassword123!',
    confirmPassword: 'TestPassword123!'
  };

  beforeEach(async () => {
    // Create unique user for each test
    testUser = {
      username: `gameuser${Date.now()}`,
      email: `game${Date.now()}@example.com`,
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!'
    };

    // Register and login to get token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    
    authToken = registerResponse.body.data.token;
  });

  describe('POST /api/game/start', () => {
    test('should start a new game successfully', async () => {
      const response = await request(app)
        .post('/api/game/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ difficulty: 'medium' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data).toHaveProperty('imageUrl');
      expect(response.body.data).toHaveProperty('timeLimit');
      expect(response.body.data.difficulty).toBe('medium');
    });

    test('should reject game start without authentication', async () => {
      const response = await request(app)
        .post('/api/game/start')
        .send({ difficulty: 'medium' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should handle different difficulty levels', async () => {
      const difficulties = ['easy', 'medium', 'hard'];
      
      for (const difficulty of difficulties) {
        const response = await request(app)
          .post('/api/game/start')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ difficulty });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.difficulty).toBe(difficulty);
      }
    });

    test('should default to medium difficulty if not specified', async () => {
      const response = await request(app)
        .post('/api/game/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.difficulty).toBe('medium');
    });
  });

  describe('POST /api/game/guess', () => {
    let gameSession: any;

    beforeEach(async () => {
      // Start a game session
      const startResponse = await request(app)
        .post('/api/game/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ difficulty: 'medium' });
      
      gameSession = startResponse.body.data;
    });

    test('should submit a guess successfully', async () => {
      const guessData = {
        sessionId: gameSession.sessionId,
        garageCount: 2,
        garageWidth: 8,
        garageHeight: 7,
        garageType: 'single',
        confidence: 85
      };

      const response = await request(app)
        .post('/api/game/guess')
        .set('Authorization', `Bearer ${authToken}`)
        .send(guessData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('score');
      expect(response.body.data).toHaveProperty('accuracy');
      expect(response.body.data).toHaveProperty('feedback');
      expect(response.body.data).toHaveProperty('correctAnswer');
      expect(response.body.data).toHaveProperty('breakdown');
    });

    test('should reject guess without authentication', async () => {
      const guessData = {
        sessionId: gameSession.sessionId,
        garageCount: 2
      };

      const response = await request(app)
        .post('/api/game/guess')
        .send(guessData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject guess without session ID', async () => {
      const guessData = {
        garageCount: 2
      };

      const response = await request(app)
        .post('/api/game/guess')
        .set('Authorization', `Bearer ${authToken}`)
        .send(guessData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Session ID is required');
    });

    test('should reject guess without garage count', async () => {
      const guessData = {
        sessionId: gameSession.sessionId
      };

      const response = await request(app)
        .post('/api/game/guess')
        .set('Authorization', `Bearer ${authToken}`)
        .send(guessData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Garage count is required');
    });

    test('should handle invalid session ID', async () => {
      const guessData = {
        sessionId: 'invalid-session-id',
        garageCount: 2
      };

      const response = await request(app)
        .post('/api/game/guess')
        .set('Authorization', `Bearer ${authToken}`)
        .send(guessData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Game session not found');
    });

    test('should calculate score based on accuracy', async () => {
      const guessData = {
        sessionId: gameSession.sessionId,
        garageCount: 2,
        confidence: 90
      };

      const response = await request(app)
        .post('/api/game/guess')
        .set('Authorization', `Bearer ${authToken}`)
        .send(guessData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data.score).toBe('number');
      expect(typeof response.body.data.accuracy).toBe('number');
      expect(typeof response.body.data.pointsEarned).toBe('number');
    });
  });

  describe('GET /api/game/history', () => {
    beforeEach(async () => {
      // Play a game to create history
      const startResponse = await request(app)
        .post('/api/game/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ difficulty: 'medium' });
      
      const gameSession = startResponse.body.data;

      await request(app)
        .post('/api/game/guess')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: gameSession.sessionId,
          garageCount: 2,
          confidence: 85
        });
    });

    test('should return game history', async () => {
      const response = await request(app)
        .get('/api/game/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.games)).toBe(true);
      expect(response.body.data.games.length).toBeGreaterThan(0);
      expect(response.body.data).toHaveProperty('totalGames');
      expect(response.body.data).toHaveProperty('averageScore');
    });

    test('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/game/history');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
