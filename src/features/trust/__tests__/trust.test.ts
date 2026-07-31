import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../app';
import { prisma } from '../../../core/db';
import { redisManager } from '../../../core/redis';
import { TripStatus, VerificationStatus } from '@prisma/client';

describe('🛡️ Trust & Safety API Integration Tests', () => {
  const emailA = 'alice.trust@example.com';
  const emailB = 'bob.trust@example.com';
  const password = 'SecurePassword123';

  let aliceId: string;
  let aliceToken: string;
  let bobId: string;
  let bobToken: string;

  let tripId: string;

  beforeEach(async () => {
    // Clear dependencies in correct order
    await prisma.travelMemory.deleteMany({});
    await prisma.rating.deleteMany({});
    await prisma.guardian.deleteMany({});
    await prisma.verificationState.deleteMany({});
    await prisma.tripMember.deleteMany({});
    await prisma.trip.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        OR: [{ email: emailA }, { email: emailB }],
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

    // Create a trip with status open
    const trip = await prisma.trip.create({
      data: {
        title: 'Roadtrip to Yosemite',
        description: 'Nature and adventure',
        origin: 'San Francisco',
        destination: 'Yosemite National Park',
        startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // in the past
        endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        maxMembers: 5,
        status: TripStatus.open,
        isHosted: false,
        members: {
          create: [
            { userId: aliceId, role: 'organizer' },
            { userId: bobId, role: 'member' },
          ],
        },
      },
    });
    tripId = trip.id;
  });

  afterAll(async () => {
    await prisma.travelMemory.deleteMany({});
    await prisma.rating.deleteMany({});
    await prisma.guardian.deleteMany({});
    await prisma.verificationState.deleteMany({});
    await prisma.tripMember.deleteMany({});
    await prisma.trip.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        OR: [{ email: emailA }, { email: emailB }],
      },
    });
    await prisma.$disconnect();
    await redisManager.disconnect();
  });

  // ─── Trust Score Engine Endpoints ──────────────────────────────────────────

  describe('GET /api/v1/trust/score', () => {
    it('Should fetch the default trust score and breakdown for logged-in user', async () => {
      const res = await request(app)
        .get('/api/v1/trust/score')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.score).toBe(38); // 30 base + 8 default rating points
      expect(res.body.data.factors.base).toBe(30);
    });

    it('Should fetch trust score for a specific user ID', async () => {
      const res = await request(app)
        .get(`/api/v1/trust/score/${bobId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.score).toBe(38);
    });

    it('Should allow manual synchronization of trust score', async () => {
      const res = await request(app)
        .post('/api/v1/trust/score/sync')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.score).toBe(38);
    });
  });

  // ─── Traveler Ratings ───────────────────────────────────────────────────────

  describe('POST /api/v1/trust/ratings', () => {
    it('Should fail if trip is not completed', async () => {
      const res = await request(app)
        .post('/api/v1/trust/ratings')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          tripId,
          rateeId: bobId,
          reliability: 5,
          communication: 5,
          respectfulness: 5,
          socialCompatibility: 5,
          funToTravelWith: 5,
          planningContribution: 5,
          review: 'Bob was an awesome partner!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TRIP_NOT_COMPLETED');
    });

    it('Should submit rating successfully when trip is completed', async () => {
      // Mark trip completed first
      await prisma.trip.update({
        where: { id: tripId },
        data: { status: TripStatus.completed },
      });

      const res = await request(app)
        .post('/api/v1/trust/ratings')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          tripId,
          rateeId: bobId,
          reliability: 5,
          communication: 4,
          respectfulness: 5,
          socialCompatibility: 4,
          funToTravelWith: 5,
          planningContribution: 3,
          review: 'Great traveling companion.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.raterId).toBe(aliceId);
      expect(res.body.data.rateeId).toBe(bobId);
      expect(res.body.data.reliability).toBe(5);

      // Verify Bob's trust score recalculates (5+4+5+4+5+3)/6 = 4.33. (4.33/5.0)*10 = 9 points for rating (was 8 default)
      const scoreRes = await request(app)
        .get(`/api/v1/trust/score/${bobId}`)
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(scoreRes.body.data.score).toBe(39); // 30 base + 9 rating points = 39

      // Attempting duplicate rating should fail
      const dupRes = await request(app)
        .post('/api/v1/trust/ratings')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          tripId,
          rateeId: bobId,
          reliability: 5,
          communication: 5,
          respectfulness: 5,
          socialCompatibility: 5,
          funToTravelWith: 5,
          planningContribution: 5,
        });
      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error.code).toBe('DUPLICATE_RATING');
    });

    it('Should reject self-rating', async () => {
      await prisma.trip.update({
        where: { id: tripId },
        data: { status: TripStatus.completed },
      });

      const res = await request(app)
        .post('/api/v1/trust/ratings')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          tripId,
          rateeId: aliceId,
          reliability: 5,
          communication: 5,
          respectfulness: 5,
          socialCompatibility: 5,
          funToTravelWith: 5,
          planningContribution: 5,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_RATING_FORBIDDEN');
    });
  });

  describe('GET /api/v1/trust/ratings/user/:userId', () => {
    it('Should retrieve users ratings and analytics breakdown', async () => {
      await prisma.trip.update({
        where: { id: tripId },
        data: { status: TripStatus.completed },
      });

      // Submit a rating
      await request(app)
        .post('/api/v1/trust/ratings')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          tripId,
          rateeId: bobId,
          reliability: 5,
          communication: 5,
          respectfulness: 5,
          socialCompatibility: 4,
          funToTravelWith: 4,
          planningContribution: 4,
        });

      // List reviews for Bob
      const listRes = await request(app)
        .get(`/api/v1/trust/ratings/user/${bobId}`)
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.items.length).toBe(1);
      expect(listRes.body.data.items[0].reliability).toBe(5);

      // Analytics for Bob
      const analyticsRes = await request(app)
        .get(`/api/v1/trust/ratings/user/${bobId}/analytics`)
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(analyticsRes.status).toBe(200);
      expect(analyticsRes.body.data.totalRatings).toBe(1);
      expect(analyticsRes.body.data.categories.reliability).toBe(5);
      expect(analyticsRes.body.data.categories.socialCompatibility).toBe(4);
    });
  });

  // ─── Identity Verification ──────────────────────────────────────────────────

  describe('Verification Endpoints', () => {
    it('Should fetch verification status, request pending state, and transition successfully', async () => {
      // Fetch initial
      const initial = await request(app)
        .get('/api/v1/trust/verification')
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(initial.status).toBe(200);
      expect(initial.body.data.phoneStatus).toBe('notStarted');

      // Request government ID verification
      const requestRes = await request(app)
        .post('/api/v1/trust/verification/request')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ type: 'governmentId' });
      expect(requestRes.status).toBe(200);
      expect(requestRes.body.data.governmentIdStatus).toBe('pending');
      expect(requestRes.body.data.governmentIdRequestedAt).not.toBeNull();

      // Update government ID status to verified (admin workflow)
      const updateRes = await request(app)
        .put(`/api/v1/trust/verification/${aliceId}/status`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ type: 'governmentId', status: 'verified' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.governmentIdStatus).toBe('verified');
      expect(updateRes.body.data.governmentIdVerifiedAt).not.toBeNull();

      // Check trust score has synced (+25 points)
      const scoreRes = await request(app)
        .get('/api/v1/trust/score')
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(scoreRes.body.data.score).toBe(63); // 30 base + 8 rating + 25 id = 63
    });
  });

  // ─── Guardians ──────────────────────────────────────────────────────────────

  describe('Guardian Management', () => {
    it('Should support full CRUD cycle of trusted guardians', async () => {
      // 1. Add guardian
      const addRes = await request(app)
        .post('/api/v1/trust/guardians')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          name: 'Sherlock Holmes',
          phone: '+15551234567',
          relationship: 'Detective Companion',
          notes: 'Call for extreme mysteries',
        });
      expect(addRes.status).toBe(201);
      expect(addRes.body.data.name).toBe('Sherlock Holmes');
      const guardianId = addRes.body.data.id;

      // Trust score should increase by +10 because guardianCount >= 1
      const scoreRes1 = await request(app)
        .get('/api/v1/trust/score')
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(scoreRes1.body.data.score).toBe(48); // 38 + 10 = 48

      // 2. List guardians
      const listRes = await request(app)
        .get('/api/v1/trust/guardians')
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);

      // 3. Update guardian
      const updateRes = await request(app)
        .put(`/api/v1/trust/guardians/${guardianId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          relationship: 'Best Friend',
          isPrimaryEmergencyContact: true,
        });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.relationship).toBe('Best Friend');
      expect(updateRes.body.data.isPrimaryEmergencyContact).toBe(true);

      // 4. Remove guardian
      const removeRes = await request(app)
        .delete(`/api/v1/trust/guardians/${guardianId}`)
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(removeRes.status).toBe(200);

      // Verify deleted
      const checkList = await request(app)
        .get('/api/v1/trust/guardians')
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(checkList.body.data.length).toBe(0);

      // Trust score should drop back to 38
      const scoreRes2 = await request(app)
        .get('/api/v1/trust/score')
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(scoreRes2.body.data.score).toBe(38);
    });

    it('Should block access to other users guardians', async () => {
      const guardian = await prisma.guardian.create({
        data: {
          userId: bobId,
          name: 'John Watson',
          phone: '+15557654321',
          relationship: 'Doctor friend',
        },
      });

      const res = await request(app)
        .put(`/api/v1/trust/guardians/${guardian.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ name: 'Hacked Watson' });

      expect(res.status).toBe(403);
    });
  });

  // ─── Travel Memories ────────────────────────────────────────────────────────

  describe('Travel Memories', () => {
    it('Should support creating, updating, visibility rules, and deleting travel memories', async () => {
      // 1. Create public memory
      const addRes = await request(app)
        .post('/api/v1/trust/memories')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          title: 'Beautiful Yosemite Sunset',
          description: 'Caught a glimpse of gold over the horizon',
          destination: 'Yosemite Park',
          mediaUrl: 'https://images.unsplash.com/sunset.jpg',
          visibility: 'public',
        });
      expect(addRes.status).toBe(201);
      const memoryId = addRes.body.data.id;

      // Trust score should increase (+2 points)
      const scoreRes1 = await request(app)
        .get('/api/v1/trust/score')
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(scoreRes1.body.data.score).toBe(40); // 38 + 2 = 40

      // 2. Create private memory
      await request(app)
        .post('/api/v1/trust/memories')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          title: 'Private campfire moments',
          description: 'Secrets in Yosemite',
          visibility: 'private',
        });

      // 3. List as self (should return both public and private)
      const selfList = await request(app)
        .get(`/api/v1/trust/memories/user/${aliceId}`)
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(selfList.status).toBe(200);
      expect(selfList.body.data.items.length).toBe(2);

      // 4. List as Bob (should only return public memory)
      const bobList = await request(app)
        .get(`/api/v1/trust/memories/user/${aliceId}`)
        .set('Authorization', `Bearer ${bobToken}`);
      expect(bobList.status).toBe(200);
      expect(bobList.body.data.items.length).toBe(1);
      expect(bobList.body.data.items[0].title).toBe('Beautiful Yosemite Sunset');

      // 5. Update memory
      const updateRes = await request(app)
        .put(`/api/v1/trust/memories/${memoryId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          title: 'Stunning Yosemite Golden Hour',
        });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Stunning Yosemite Golden Hour');

      // 6. Delete memory
      const delRes = await request(app)
        .delete(`/api/v1/trust/memories/${memoryId}`)
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(delRes.status).toBe(200);

      // Verify deletion
      const listAfterDelete = await request(app)
        .get(`/api/v1/trust/memories/user/${aliceId}`)
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(listAfterDelete.body.data.items.length).toBe(1);
    });
  });
});
