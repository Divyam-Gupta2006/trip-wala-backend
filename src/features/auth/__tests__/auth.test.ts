import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../app';
import { prisma } from '../../../core/db';
import { redisManager } from '../../../core/redis';

describe('🔐 Authentication Endpoints API Integration Tests', () => {
  const testEmail = 'testing.user@example.com';
  const testPassword = 'SecurePassword123';

  // Ensure clean DB before each test
  beforeEach(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
  });

  afterAll(async () => {
    // Cleanup DB users and close connections
    await prisma.refreshToken.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
    await prisma.$disconnect();
    await redisManager.disconnect();
  });

  it('1. POST /api/v1/auth/register - Should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test Runner',
        email: testEmail,
        password: testPassword,
        age: 25,
        deviceId: 'test-device-uuid',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.user.name).toBe('Test Runner');
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');

    // Confirm DB write
    const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(dbUser).not.toBeNull();
  });

  it('2. POST /api/v1/auth/register - Should fail if email is already taken', async () => {
    // Register first user
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test Runner',
        email: testEmail,
        password: testPassword,
        age: 25,
      });

    // Attempt second registration
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Duplicate Runner',
        email: testEmail,
        password: 'anotherPassword123',
        age: 28,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('3. POST /api/v1/auth/login - Should login with correct credentials', async () => {
    // Register first
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test Runner',
        email: testEmail,
        password: testPassword,
        age: 25,
      });

    // Login
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
        deviceId: 'test-device-uuid',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
  });

  it('4. POST /api/v1/auth/login - Should fail with incorrect password', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test Runner',
        email: testEmail,
        password: testPassword,
        age: 25,
      });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword123',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('5. GET /api/v1/users/me - Should fetch profile with valid access token', async () => {
    // Register and get access token
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test Runner',
        email: testEmail,
        password: testPassword,
        age: 25,
      });

    const accessToken = regRes.body.data.accessToken;

    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.user.name).toBe('Test Runner');
  });

  it('6. GET /api/v1/users/me - Should block requests with missing or expired token', async () => {
    const res = await request(app)
      .get('/api/v1/users/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TOKEN_MISSING');
  });

  it('7. POST /api/v1/auth/refresh - Should rotate and issue new tokens', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test Runner',
        email: testEmail,
        password: testPassword,
        age: 25,
      });

    const refreshToken = regRes.body.data.refreshToken;

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');

    // Attempting to reuse old refresh token should fail (token rotation)
    const reuseRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.success).toBe(false);
  });

  it('8. POST /api/v1/auth/logout - Should end active session', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test Runner',
        email: testEmail,
        password: testPassword,
        age: 25,
      });

    const { accessToken, refreshToken } = regRes.body.data;

    // Logout
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Verify session removed from database
    const profileRes = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(profileRes.status).toBe(401);

    // Refresh should also fail
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(401);
  });
});
