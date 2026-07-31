"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../../app"));
const db_1 = require("../../../core/db");
const redis_1 = require("../../../core/redis");
(0, vitest_1.describe)('✈️ Trips Endpoints API Integration Tests', () => {
    const emailA = 'alice.trips@example.com';
    const emailB = 'bob.trips@example.com';
    const password = 'SecurePassword123';
    let aliceId;
    let aliceToken;
    let bobId;
    let bobToken;
    (0, vitest_1.beforeEach)(async () => {
        // Clean up database records
        await db_1.prisma.tripMember.deleteMany({});
        await db_1.prisma.trip.deleteMany({});
        await db_1.prisma.refreshToken.deleteMany({});
        await db_1.prisma.session.deleteMany({});
        await db_1.prisma.user.deleteMany({
            where: {
                OR: [
                    { email: emailA },
                    { email: emailB },
                ],
            },
        });
        // Create Alice
        const regAlice = await (0, supertest_1.default)(app_1.default)
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
        const regBob = await (0, supertest_1.default)(app_1.default)
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
    (0, vitest_1.afterAll)(async () => {
        await db_1.prisma.tripMember.deleteMany({});
        await db_1.prisma.trip.deleteMany({});
        await db_1.prisma.refreshToken.deleteMany({});
        await db_1.prisma.session.deleteMany({});
        await db_1.prisma.user.deleteMany({
            where: {
                OR: [
                    { email: emailA },
                    { email: emailB },
                ],
            },
        });
        await db_1.prisma.$disconnect();
        await redis_1.redisManager.disconnect();
    });
    (0, vitest_1.describe)('POST /api/v1/trips', () => {
        (0, vitest_1.it)('Should successfully create a new trip with Alice as organizer', async () => {
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
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/trips')
                .set('Authorization', `Bearer ${aliceToken}`)
                .send(tripPayload);
            (0, vitest_1.expect)(res.status).toBe(201);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.title).toBe('Bali Summer Getaway');
            (0, vitest_1.expect)(res.body.data.destination).toBe('Bali, Indonesia');
            (0, vitest_1.expect)(res.body.data.budget).toBe(1500);
            (0, vitest_1.expect)(res.body.data.status).toBe('open');
            (0, vitest_1.expect)(res.body.data.members.length).toBe(1);
            (0, vitest_1.expect)(res.body.data.members[0].userId).toBe(aliceId);
            (0, vitest_1.expect)(res.body.data.members[0].role).toBe('organizer');
        });
        (0, vitest_1.it)('Should fail if endDate is before startDate', async () => {
            const invalidPayload = {
                title: 'Instant Trip',
                description: 'This trip goes backwards in time.',
                origin: 'Seattle',
                destination: 'Portland',
                startDate: '2026-08-10T00:00:00.000Z',
                endDate: '2026-08-05T00:00:00.000Z',
                maxMembers: 4,
            };
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/trips')
                .set('Authorization', `Bearer ${aliceToken}`)
                .send(invalidPayload);
            (0, vitest_1.expect)(res.status).toBe(400);
            (0, vitest_1.expect)(res.body.success).toBe(false);
            (0, vitest_1.expect)(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });
    (0, vitest_1.describe)('GET /api/v1/trips/:id', () => {
        let publicTripId;
        let privateTripId;
        (0, vitest_1.beforeEach)(async () => {
            // Create public trip
            const pubRes = await (0, supertest_1.default)(app_1.default)
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
            const privRes = await (0, supertest_1.default)(app_1.default)
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
        (0, vitest_1.it)('Should retrieve details of a public trip for anyone authorized', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/trips/${publicTripId}`)
                .set('Authorization', `Bearer ${bobToken}`);
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.id).toBe(publicTripId);
        });
        (0, vitest_1.it)('Should allow organizer to view private trip details', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/trips/${privateTripId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        });
        (0, vitest_1.it)('Should block Bob from viewing Alice private trip details', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/trips/${privateTripId}`)
                .set('Authorization', `Bearer ${bobToken}`);
            (0, vitest_1.expect)(res.status).toBe(403);
            (0, vitest_1.expect)(res.body.success).toBe(false);
            (0, vitest_1.expect)(res.body.error.code).toBe('FORBIDDEN_TRIP_ACCESS');
        });
    });
    (0, vitest_1.describe)('PUT /api/v1/trips/:id', () => {
        let tripId;
        (0, vitest_1.beforeEach)(async () => {
            const res = await (0, supertest_1.default)(app_1.default)
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
        (0, vitest_1.it)('Should allow Alice (organizer) to update fields & status', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .put(`/api/v1/trips/${tripId}`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({
                title: 'Hike Mt. Rainier Peak',
                maxMembers: 8,
                status: 'full',
            });
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.title).toBe('Hike Mt. Rainier Peak');
            (0, vitest_1.expect)(res.body.data.maxMembers).toBe(8);
            (0, vitest_1.expect)(res.body.data.status).toBe('full');
        });
        (0, vitest_1.it)('Should reject updates by Bob (non-organizer)', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .put(`/api/v1/trips/${tripId}`)
                .set('Authorization', `Bearer ${bobToken}`)
                .send({ title: 'Bob Hijack' });
            (0, vitest_1.expect)(res.status).toBe(403);
            (0, vitest_1.expect)(res.body.success).toBe(false);
            (0, vitest_1.expect)(res.body.error.code).toBe('FORBIDDEN_TRIP_UPDATE');
        });
        (0, vitest_1.it)('Should reject invalid status transitions (e.g. from open to draft)', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .put(`/api/v1/trips/${tripId}`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ status: 'draft' });
            (0, vitest_1.expect)(res.status).toBe(400);
            (0, vitest_1.expect)(res.body.success).toBe(false);
            (0, vitest_1.expect)(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
        });
    });
    (0, vitest_1.describe)('DELETE /api/v1/trips/:id', () => {
        let tripId;
        (0, vitest_1.beforeEach)(async () => {
            const res = await (0, supertest_1.default)(app_1.default)
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
        (0, vitest_1.it)('Should allow Alice to soft delete the trip', async () => {
            const delRes = await (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/trips/${tripId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(delRes.status).toBe(200);
            (0, vitest_1.expect)(delRes.body.success).toBe(true);
            // Verify soft deleted status in DB
            const dbTrip = await db_1.prisma.trip.findUnique({ where: { id: tripId } });
            (0, vitest_1.expect)(dbTrip?.isDeleted).toBe(true);
            (0, vitest_1.expect)(dbTrip?.status).toBe('cancelled');
            // GET should now return 404
            const getRes = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/trips/${tripId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(getRes.status).toBe(404);
        });
        (0, vitest_1.it)('Should reject deletion if requested by Bob (non-organizer)', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/trips/${tripId}`)
                .set('Authorization', `Bearer ${bobToken}`);
            (0, vitest_1.expect)(res.status).toBe(403);
            (0, vitest_1.expect)(res.body.success).toBe(false);
            (0, vitest_1.expect)(res.body.error.code).toBe('FORBIDDEN_TRIP_DELETE');
        });
    });
    (0, vitest_1.describe)('GET /api/v1/trips (Search & Discover)', () => {
        (0, vitest_1.beforeEach)(async () => {
            // Trip 1
            await (0, supertest_1.default)(app_1.default)
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
            await (0, supertest_1.default)(app_1.default)
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
        (0, vitest_1.it)('Should filter search results by destination or budget', async () => {
            // Filter destination 'Alps'
            const res1 = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/trips')
                .query({ destination: 'Alps' })
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(res1.status).toBe(200);
            (0, vitest_1.expect)(res1.body.data.trips.length).toBe(1);
            (0, vitest_1.expect)(res1.body.data.trips[0].destination).toBe('Alps');
            // Filter budget <= 1000
            const res2 = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/trips')
                .query({ budget: '1000' })
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(res2.status).toBe(200);
            (0, vitest_1.expect)(res2.body.data.trips.length).toBe(1);
            (0, vitest_1.expect)(res2.body.data.trips[0].budget).toBe(800);
        });
        (0, vitest_1.it)('Should filter by languages', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/trips')
                .query({ languages: 'Japanese' })
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.data.trips.length).toBe(1);
            (0, vitest_1.expect)(res.body.data.trips[0].title).toBe('Trip One');
        });
    });
    (0, vitest_1.describe)('GET /api/v1/trips/user/:userId', () => {
        let tripId;
        (0, vitest_1.beforeEach)(async () => {
            const res = await (0, supertest_1.default)(app_1.default)
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
        (0, vitest_1.it)('Should fetch Alice hosted trips successfully', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/trips/user/${aliceId}/hosted`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.data.length).toBe(1);
            (0, vitest_1.expect)(res.body.data[0].id).toBe(tripId);
        });
        (0, vitest_1.it)('Should fetch Alice trips via me alias', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/trips/user/me')
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.data.length).toBe(1);
            (0, vitest_1.expect)(res.body.data[0].id).toBe(tripId);
        });
    });
});
