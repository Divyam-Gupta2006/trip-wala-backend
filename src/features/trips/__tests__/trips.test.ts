import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../app';
import { prisma } from '../../../core/db';
import { redisManager } from '../../../core/redis';

describe('✈️ Trips Endpoints API Integration Tests', () => {
  const emailA = 'alice.trips@example.com';
  const emailB = 'bob.trips@example.com';
  const password = 'SecurePassword123';

  let aliceId: string;
  let aliceToken: string;
  let bobId: string;
  let bobToken: string;

  beforeEach(async () => {
    // Clean up database records
    await prisma.tripMember.deleteMany({});
    await prisma.trip.deleteMany({});
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
        name: 'Alice Traveler',
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
        name: 'Bob Backpacker',
        email: emailB,
        password,
        age: 30,
      });
    bobId = regBob.body.data.user.id;
    bobToken = regBob.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.tripMember.deleteMany({});
    await prisma.trip.deleteMany({});
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

  describe('POST /api/v1/trips', () => {
    it('Should successfully create a new trip with Alice as organizer', async () => {
      const tripPayload = {
        title: 'Bali Summer Getaway',
        description: 'Chasing sunsets and surfing waves in Bali.',
        origin: 'Seattle, USA',
        destination: 'Bali, Indonesia',
        meetingPoint: 'Denpasar International Airport Terminal 2',
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-08-10T00:00:00.000Z',
        budget: 1500,
        budgetPreference: 'balanced',
        maxMembers: 5,
        category: 'Adventure',
        categories: ['Beach', 'Culture'],
        difficulty: 'moderate',
        languages: ['English', 'Indonesian'],
        visibility: 'public',
        requirements: ['Passport valid for 6 months', 'Vaccination certificate'],
        tags: ['bali', 'surfing', 'nature'],
        isHosted: false,
        itinerary: [
          {
            dayNumber: 1,
            title: 'Arrival & Welcome Dinner',
            description: 'Check in to the resort and meet the group.',
            activities: ['Hotel check-in', 'Beachside dinner'],
          },
        ],
      };

      const res = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send(tripPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Bali Summer Getaway');
      expect(res.body.data.destination).toBe('Bali, Indonesia');
      expect(res.body.data.budget).toBe(1500);
      expect(res.body.data.status).toBe('open');
      expect(res.body.data.members.length).toBe(1);
      expect(res.body.data.members[0].userId).toBe(aliceId);
      expect(res.body.data.members[0].role).toBe('organizer');
    });

    it('Should fail if endDate is before startDate', async () => {
      const invalidPayload = {
        title: 'Instant Trip',
        description: 'This trip goes backwards in time.',
        origin: 'Seattle',
        destination: 'Portland',
        startDate: '2026-08-10T00:00:00.000Z',
        endDate: '2026-08-05T00:00:00.000Z',
        maxMembers: 4,
      };

      const res = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/trips/:id', () => {
    let publicTripId: string;
    let privateTripId: string;

    beforeEach(async () => {
      // Create public trip
      const pubRes = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          title: 'Public Sightseeing',
          description: 'Fun exploration around town.',
          origin: 'Seattle',
          destination: 'Vancouver',
          startDate: '2026-09-01T00:00:00.000Z',
          endDate: '2026-09-05T00:00:00.000Z',
          maxMembers: 10,
          visibility: 'public',
        });
      publicTripId = pubRes.body.data.id;

      // Create private trip
      const privRes = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          title: 'Private Gathering',
          description: 'Members-only secret trip.',
          origin: 'Seattle',
          destination: 'Cabin in Woods',
          startDate: '2026-09-10T00:00:00.000Z',
          endDate: '2026-09-15T00:00:00.000Z',
          maxMembers: 4,
          visibility: 'private',
        });
      privateTripId = privRes.body.data.id;
    });

    it('Should retrieve details of a public trip for anyone authorized', async () => {
      const res = await request(app)
        .get(`/api/v1/trips/${publicTripId}`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(publicTripId);
    });

    it('Should allow organizer to view private trip details', async () => {
      const res = await request(app)
        .get(`/api/v1/trips/${privateTripId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('Should block Bob from viewing Alice private trip details', async () => {
      const res = await request(app)
        .get(`/api/v1/trips/${privateTripId}`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_TRIP_ACCESS');
    });
  });

  describe('PUT /api/v1/trips/:id', () => {
    let tripId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          title: 'Hike Mt. Rainier',
          description: 'Hiking to Camp Muir.',
          origin: 'Seattle',
          destination: 'Mt. Rainier',
          startDate: '2026-08-20T00:00:00.000Z',
          endDate: '2026-08-22T00:00:00.000Z',
          maxMembers: 6,
          status: 'open',
        });
      tripId = res.body.data.id;
    });

    it('Should allow Alice (organizer) to update fields & status', async () => {
      const res = await request(app)
        .put(`/api/v1/trips/${tripId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          title: 'Hike Mt. Rainier Peak',
          maxMembers: 8,
          status: 'full',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Hike Mt. Rainier Peak');
      expect(res.body.data.maxMembers).toBe(8);
      expect(res.body.data.status).toBe('full');
    });

    it('Should reject updates by Bob (non-organizer)', async () => {
      const res = await request(app)
        .put(`/api/v1/trips/${tripId}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ title: 'Bob Hijack' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_TRIP_UPDATE');
    });

    it('Should reject invalid status transitions (e.g. from open to draft)', async () => {
      const res = await request(app)
        .put(`/api/v1/trips/${tripId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ status: 'draft' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  describe('DELETE /api/v1/trips/:id', () => {
    let tripId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          title: 'Camp in Olympic National Park',
          description: 'Hoh rain forest camping.',
          origin: 'Seattle',
          destination: 'Olympic NP',
          startDate: '2026-09-01T00:00:00.000Z',
          endDate: '2026-09-04T00:00:00.000Z',
          maxMembers: 4,
        });
      tripId = res.body.data.id;
    });

    it('Should allow Alice to soft delete the trip', async () => {
      const delRes = await request(app)
        .delete(`/api/v1/trips/${tripId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      // Verify soft deleted status in DB
      const dbTrip = await prisma.trip.findUnique({ where: { id: tripId } });
      expect(dbTrip?.isDeleted).toBe(true);
      expect(dbTrip?.status).toBe('cancelled');

      // GET should now return 404
      const getRes = await request(app)
        .get(`/api/v1/trips/${tripId}`)
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(getRes.status).toBe(404);
    });

    it('Should reject deletion if requested by Bob (non-organizer)', async () => {
      const res = await request(app)
        .delete(`/api/v1/trips/${tripId}`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_TRIP_DELETE');
    });
  });

  describe('GET /api/v1/trips (Search & Discover)', () => {
    beforeEach(async () => {
      // Trip 1
      await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          title: 'Trip One',
          description: 'Exploring Tokyo temples.',
          origin: 'Tokyo',
          destination: 'Tokyo',
          startDate: '2026-10-01T00:00:00.000Z',
          endDate: '2026-10-10T00:00:00.000Z',
          budget: 2000,
          budgetPreference: 'luxury',
          maxMembers: 4,
          category: 'Culture',
          languages: ['Japanese', 'English'],
        });

      // Trip 2
      await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          title: 'Trip Two',
          description: 'Hiking the Alps.',
          origin: 'Geneva',
          destination: 'Alps',
          startDate: '2026-11-01T00:00:00.000Z',
          endDate: '2026-11-07T00:00:00.000Z',
          budget: 800,
          budgetPreference: 'budget',
          maxMembers: 6,
          category: 'Adventure',
          languages: ['French', 'English'],
        });
    });

    it('Should filter search results by destination or budget', async () => {
      // Filter destination 'Alps'
      const res1 = await request(app)
        .get('/api/v1/trips')
        .query({ destination: 'Alps' })
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res1.status).toBe(200);
      expect(res1.body.data.trips.length).toBe(1);
      expect(res1.body.data.trips[0].destination).toBe('Alps');

      // Filter budget <= 1000
      const res2 = await request(app)
        .get('/api/v1/trips')
        .query({ budget: '1000' })
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.data.trips.length).toBe(1);
      expect(res2.body.data.trips[0].budget).toBe(800);
    });

    it('Should filter by languages', async () => {
      const res = await request(app)
        .get('/api/v1/trips')
        .query({ languages: 'Japanese' })
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.trips.length).toBe(1);
      expect(res.body.data.trips[0].title).toBe('Trip One');
    });
  });

  describe('GET /api/v1/trips/user/:userId', () => {
    let tripId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          title: 'Alice Hosted Trip',
          description: 'Fun trip for everyone.',
          origin: 'Seattle',
          destination: 'Miami',
          startDate: '2026-12-01T00:00:00.000Z',
          endDate: '2026-12-05T00:00:00.000Z',
          maxMembers: 4,
        });
      tripId = res.body.data.id;
    });

    it('Should fetch Alice hosted trips successfully', async () => {
      const res = await request(app)
        .get(`/api/v1/trips/user/${aliceId}/hosted`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(tripId);
    });

    it('Should fetch Alice trips via me alias', async () => {
      const res = await request(app)
        .get('/api/v1/trips/user/me')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(tripId);
    });
  });
});
