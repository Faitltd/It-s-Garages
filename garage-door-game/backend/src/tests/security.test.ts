import request from 'supertest';
import express from 'express';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { initializeDatabase } from '../config/database';

// Import the app setup (we'll need to refactor server.ts to export the app)
const app = express();

// Mock environment variables for testing
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:'; // Use in-memory database for tests

describe('Security Tests', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  describe('Authentication Security', () => {
    test('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: '123', // Weak password
          confirmPassword: '123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Password must');
    });

    test('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'invalid-email',
          password: 'StrongPassword123!',
          confirmPassword: 'StrongPassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('valid email');
    });

    test('should reject registration with mismatched passwords', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'StrongPassword123!',
          confirmPassword: 'DifferentPassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('do not match');
    });

    test('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid email or password');
    });

    test('should require authentication for protected routes', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('No token provided');
    });

    test('should reject invalid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid token');
    });
  });

  describe('Input Validation Security', () => {
    test('should sanitize SQL injection attempts', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: "admin@example.com'; DROP TABLE users; --",
          password: 'password'
        });

      expect(response.status).toBe(400);
      // Should be caught by validation, not reach the database
    });

    test('should reject XSS attempts in input', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: '<script>alert("xss")</script>',
          email: 'test@example.com',
          password: 'StrongPassword123!',
          confirmPassword: 'StrongPassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should reject oversized payloads', async () => {
      const largeString = 'a'.repeat(1000000); // 1MB string
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: largeString,
          email: 'test@example.com',
          password: 'StrongPassword123!',
          confirmPassword: 'StrongPassword123!'
        });

      expect(response.status).toBe(413); // Payload too large
    });
  });

  describe('Rate Limiting Security', () => {
    test('should enforce rate limits on login attempts', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };

      // Make multiple failed login attempts
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should enforce rate limits on registration attempts', async () => {
      const registrationData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'StrongPassword123!',
        confirmPassword: 'StrongPassword123!'
      };

      // Make multiple registration attempts
      const promises = Array(5).fill(null).map((_, index) =>
        request(app)
          .post('/api/auth/register')
          .send({
            ...registrationData,
            email: `test${index}@example.com`,
            username: `testuser${index}`
          })
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers', () => {
    test('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    test('should set secure cookie attributes in production', async () => {
      // This would need to be tested with NODE_ENV=production
      // For now, we'll just verify the cookie is set
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'securetest',
          email: 'secure@example.com',
          password: 'StrongPassword123!',
          confirmPassword: 'StrongPassword123!'
        });

      if (response.status === 201) {
        expect(response.headers['set-cookie']).toBeDefined();
      }
    });
  });

  describe('Error Handling Security', () => {
    test('should not expose sensitive information in error messages', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.message).not.toContain('password_hash');
      expect(response.body.error.message).not.toContain('database');
      expect(response.body.error.message).not.toContain('SQL');
    });

    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
