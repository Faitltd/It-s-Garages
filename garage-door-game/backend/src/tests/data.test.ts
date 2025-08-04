import request from 'supertest';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createApp } from '../app';
import './setup';

const app = createApp();

describe('Data Submission API', () => {
  let authToken: string;
  let testUser = {
    username: 'datauser',
    email: 'data@example.com',
    password: 'TestPassword123!',
    confirmPassword: 'TestPassword123!'
  };

  beforeEach(async () => {
    // Create unique user for each test
    testUser = {
      username: `datauser${Date.now()}`,
      email: `data${Date.now()}@example.com`,
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!'
    };

    // Register and login to get token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    
    authToken = registerResponse.body.data.token;
  });

  describe('POST /api/data/submit', () => {
    test('should submit garage door data successfully', async () => {
      const submissionData = {
        address: '123 Test Street, Test City, TC 12345',
        doors: [
          { size: '8x7 feet' },
          { size: '9x8 feet' }
        ]
      };

      const response = await request(app)
        .post('/api/data/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(submissionData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Successfully submitted');
      expect(response.body.pointsAwarded).toBe(100); // 50 points per door
      expect(response.body.doorsSubmitted).toBe(2);
    });

    test('should reject submission without authentication', async () => {
      const submissionData = {
        address: '123 Test Street',
        doors: [{ size: '8x7 feet' }]
      };

      const response = await request(app)
        .post('/api/data/submit')
        .send(submissionData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No token provided');
    });

    test('should reject submission without address', async () => {
      const submissionData = {
        doors: [{ size: '8x7 feet' }]
      };

      const response = await request(app)
        .post('/api/data/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(submissionData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Address and at least one door size are required');
    });

    test('should reject submission without doors', async () => {
      const submissionData = {
        address: '123 Test Street'
      };

      const response = await request(app)
        .post('/api/data/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(submissionData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Address and at least one door size are required');
    });

    test('should reject submission with empty doors array', async () => {
      const submissionData = {
        address: '123 Test Street',
        doors: []
      };

      const response = await request(app)
        .post('/api/data/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(submissionData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Address and at least one door size are required');
    });

    test('should reject submission with invalid door data', async () => {
      const submissionData = {
        address: '123 Test Street',
        doors: [{ size: '' }] // Empty size
      };

      const response = await request(app)
        .post('/api/data/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(submissionData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Each door must have a valid size');
    });

    test('should handle multiple doors correctly', async () => {
      const submissionData = {
        address: '456 Multi Door Street',
        doors: [
          { size: '8x7 feet' },
          { size: '9x8 feet' },
          { size: '10x8 feet' }
        ]
      };

      const response = await request(app)
        .post('/api/data/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(submissionData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.pointsAwarded).toBe(150); // 50 points per door
      expect(response.body.doorsSubmitted).toBe(3);
    });
  });

  describe('GET /api/data/my-submissions', () => {
    beforeEach(async () => {
      // Submit some test data
      await request(app)
        .post('/api/data/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          address: '123 Test Street',
          doors: [{ size: '8x7 feet' }]
        });

      await request(app)
        .post('/api/data/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          address: '456 Another Street',
          doors: [{ size: '9x8 feet' }]
        });
    });

    test('should return user submissions', async () => {
      const response = await request(app)
        .get('/api/data/my-submissions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.submissions)).toBe(true);
      expect(response.body.submissions.length).toBeGreaterThan(0);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
    });

    test('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/data/my-submissions');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/data/my-submissions?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
    });
  });
});
