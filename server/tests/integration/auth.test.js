import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../../routes/auth.js';
import { createTestUser, cleanupTestData } from '../helpers/db.js';
import { closeDb } from '../../database.js';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

const describeIntegration =
  process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeIntegration('Auth Routes Integration', () => {
  afterAll(async () => {
    await cleanupTestData();
    await closeDb();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: `test-register-${Date.now()}@example.com`,
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
          companyName: 'Test Company'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBeDefined();
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject registration with short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: '123' // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject duplicate email registration', async () => {
      const email = `test-duplicate-${Date.now()}@example.com`;
      
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'password123' });

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'password123' });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser;

    beforeEach(async () => {
      await cleanupTestData();
      testUser = await createTestUser({ password: 'correctpassword' });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'correctpassword'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email ou mot de passe incorrect.');
    });

    it('should reject login for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject login with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email }); // Missing password

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should have consistent timing for existing and non-existing users (timing attack protection)', async () => {
      const start1 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent-timing@test.com', password: 'pass' });
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrong' });
      const time2 = Date.now() - start2;

      // Times should be similar (within 100ms)
      expect(Math.abs(time1 - time2)).toBeLessThan(100);
    });
  });
});
