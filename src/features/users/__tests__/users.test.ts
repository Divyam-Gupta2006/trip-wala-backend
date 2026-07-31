import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../app';
import { prisma } from '../../../core/db';
import { redisManager } from '../../../core/redis';

describe('👤 Users & Profiles Endpoints API Integration Tests', () => {
  const emailA = 'alice.test@example.com';
  const emailB = 'bob.test@example.com';
  const password = 'SecurePassword123';

  let aliceId: string;
  let aliceToken: string;
  let bobId: string;
  let bobToken: string;

  beforeEach(async () => {
    // Clean up test users
    await prisma.refreshToken.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: emailA },
          { email: emailB },
        ],
      },
    });

    // Create Alice
    const regAlice = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Alice Cooper',
        email: emailA,
        password,
        age: 26,
      });
    aliceId = regAlice.body.data.user.id;
    aliceToken = regAlice.body.data.accessToken;

    // Create Bob
    const regBob = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Bob Marley',
        email: emailB,
        password,
        age: 35,
      });
    bobId = regBob.body.data.user.id;
    bobToken = regBob.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: emailA },
          { email: emailB },
        ],
      },
    });
    await prisma.$disconnect();
    await redisManager.disconnect();
  });

  describe('GET /api/v1/profiles/:userId', () => {
    it('Should retrieve Alice public flat profile successfully', async () => {
      const res = await request(app)
        .get(`/api/v1/profiles/${aliceId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(aliceId);
      expect(res.body.data.name).toBe('Alice Cooper');
      expect(res.body.data.email).toBe(emailA);
      expect(res.body.data.age).toBe(26);
      expect(res.body.data).toHaveProperty('statistics');
      expect(res.body.data.statistics.completedTrips).toBe(0);
    });

    it('Should fail with 404 for non-existing user profile', async () => {
      const res = await request(app)
        .get('/api/v1/profiles/non-existent-user-id')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROFILE_NOT_FOUND');
    });
  });

  describe('PUT /api/v1/profiles/:userId', () => {
    it('Should allow Alice to update her own profile details', async () => {
      const updateData = {
        name: 'Alice C.',
        username: 'alice_cooper',
        bio: 'Explorer of wild forests and deep oceans',
        location: 'Seattle, USA',
        interests: ['Hiking', 'Scuba', 'Camping'],
        travelStyles: ['Adventure', 'Nature'],
        budgetPreference: 'budget' as const,
        languages: ['English', 'Spanish'],
      };

      const res = await request(app)
        .put(`/api/v1/profiles/${aliceId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Alice C.');
      expect(res.body.data.username).toBe('alice_cooper');
      expect(res.body.data.bio).toBe('Explorer of wild forests and deep oceans');
      expect(res.body.data.location).toBe('Seattle, USA');
      expect(res.body.data.interests).toEqual(['Hiking', 'Scuba', 'Camping']);
      expect(res.body.data.budgetPreference).toBe('budget');
    });

    it('Should reject updates to Bob profile by Alice (Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/v1/profiles/${bobId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ name: 'Hack Bob' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_PROFILE_UPDATE');
    });

    it('Should reject username if already taken', async () => {
      // Alice claims 'traveler_one'
      await request(app)
        .put(`/api/v1/profiles/${aliceId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ username: 'traveler_one' });

      // Bob attempts to claim 'traveler_one'
      const res = await request(app)
        .put(`/api/v1/profiles/${bobId}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ username: 'traveler_one' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('USERNAME_ALREADY_EXISTS');
    });

    it('Should reject invalid fields (Validation Failure)', async () => {
      const res = await request(app)
        .put(`/api/v1/profiles/${aliceId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          avatarUrl: 'not-a-valid-url',
          age: 12, // too young
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/profiles (Search)', () => {
    it('Should return paginated matching profiles on search parameters', async () => {
      // Set unique usernames/locations first
      await request(app)
        .put(`/api/v1/profiles/${aliceId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ username: 'alice_super_traveler', budgetPreference: 'budget', location: 'Paris' });

      await request(app)
        .put(`/api/v1/profiles/${bobId}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ username: 'bob_chill_traveler', budgetPreference: 'luxury', location: 'London' });

      // Search matching 'traveler'
      const searchRes = await request(app)
        .get('/api/v1/profiles')
        .query({ query: 'traveler' })
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.success).toBe(true);
      const matchingTestUsers = searchRes.body.data.profiles.filter(
        (p: any) => p.userId === aliceId || p.userId === bobId
      );
      expect(matchingTestUsers.length).toBe(2);

      // Search matching budgetPreference 'luxury'
      const budgetRes = await request(app)
        .get('/api/v1/profiles')
        .query({ budgetPreference: 'luxury' })
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(budgetRes.status).toBe(200);
      const luxuryTestUsers = budgetRes.body.data.profiles.filter(
        (p: any) => p.userId === aliceId || p.userId === bobId
      );
      expect(luxuryTestUsers.length).toBe(1);
      expect(luxuryTestUsers[0].userId).toBe(bobId);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('Should fetch user details by ID successfully', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${bobId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(bobId);
      expect(res.body.data.user.email).toBe(emailB);
    });
  });

  describe('DELETE /api/v1/users/:id (Soft Delete)', () => {
    it('Should allow user to soft delete their own account and block login', async () => {
      const deleteRes = await request(app)
        .delete(`/api/v1/users/${aliceId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Verify db state
      const dbUser = await prisma.user.findUnique({
        where: { id: aliceId },
      });
      expect(dbUser?.isDeleted).toBe(true);
      expect(dbUser?.deletedAt).not.toBeNull();

      // Subsequent api requests with Alice token should be blocked
      const meRes = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(meRes.status).toBe(401);

      // Login should also fail
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: emailA,
          password,
        });
      expect(loginRes.status).toBe(401);
    });

    it('Should block Alice from deleting Bob account (Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${bobId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_USER_DELETE');
    });
  });
});
