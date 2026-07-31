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
const client_1 = require("@prisma/client");
(0, vitest_1.describe)('🛡️ Trust & Safety API Integration Tests', () => {
    const emailA = 'alice.trust@example.com';
    const emailB = 'bob.trust@example.com';
    const password = 'SecurePassword123';
    let aliceId;
    let aliceToken;
    let bobId;
    let bobToken;
    let tripId;
    (0, vitest_1.beforeEach)(async () => {
        // Clear dependencies in correct order
        await db_1.prisma.travelMemory.deleteMany({});
        await db_1.prisma.rating.deleteMany({});
        await db_1.prisma.guardian.deleteMany({});
        await db_1.prisma.verificationState.deleteMany({});
        await db_1.prisma.tripMember.deleteMany({});
        await db_1.prisma.trip.deleteMany({});
        await db_1.prisma.refreshToken.deleteMany({});
        await db_1.prisma.session.deleteMany({});
        await db_1.prisma.user.deleteMany({
            where: {
                OR: [{ email: emailA }, { email: emailB }],
            },
        });
        // Create Alice
        const regAlice = await (0, supertest_1.default)(app_1.default)
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
        const regBob = await (0, supertest_1.default)(app_1.default)
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
        const trip = await db_1.prisma.trip.create({
            data: {
                title: 'Roadtrip to Yosemite',
                description: 'Nature and adventure',
                origin: 'San Francisco',
                destination: 'Yosemite National Park',
                startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // in the past
                endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                maxMembers: 5,
                status: client_1.TripStatus.open,
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
    (0, vitest_1.afterAll)(async () => {
        await db_1.prisma.travelMemory.deleteMany({});
        await db_1.prisma.rating.deleteMany({});
        await db_1.prisma.guardian.deleteMany({});
        await db_1.prisma.verificationState.deleteMany({});
        await db_1.prisma.tripMember.deleteMany({});
        await db_1.prisma.trip.deleteMany({});
        await db_1.prisma.refreshToken.deleteMany({});
        await db_1.prisma.session.deleteMany({});
        await db_1.prisma.user.deleteMany({
            where: {
                OR: [{ email: emailA }, { email: emailB }],
            },
        });
        await db_1.prisma.$disconnect();
        await redis_1.redisManager.disconnect();
    });
    // ─── Trust Score Engine Endpoints ──────────────────────────────────────────
    (0, vitest_1.describe)('GET /api/v1/trust/score', () => {
        (0, vitest_1.it)('Should fetch the default trust score and breakdown for logged-in user', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/trust/score')
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.score).toBe(38); // 30 base + 8 default rating points
            (0, vitest_1.expect)(res.body.data.factors.base).toBe(30);
        });
        (0, vitest_1.it)('Should fetch trust score for a specific user ID', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/trust/score/${bobId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.score).toBe(38);
        });
        (0, vitest_1.it)('Should allow manual synchronization of trust score', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/trust/score/sync')
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.score).toBe(38);
        });
    });
    // ─── Traveler Ratings ───────────────────────────────────────────────────────
    (0, vitest_1.describe)('POST /api/v1/trust/ratings', () => {
        (0, vitest_1.it)('Should fail if trip is not completed', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
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
            (0, vitest_1.expect)(res.status).toBe(400);
            (0, vitest_1.expect)(res.body.error.code).toBe('TRIP_NOT_COMPLETED');
        });
        (0, vitest_1.it)('Should submit rating successfully when trip is completed', async () => {
            // Mark trip completed first
            await db_1.prisma.trip.update({
                where: { id: tripId },
                data: { status: client_1.TripStatus.completed },
            });
            const res = await (0, supertest_1.default)(app_1.default)
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
            (0, vitest_1.expect)(res.status).toBe(201);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.raterId).toBe(aliceId);
            (0, vitest_1.expect)(res.body.data.rateeId).toBe(bobId);
            (0, vitest_1.expect)(res.body.data.reliability).toBe(5);
            // Verify Bob's trust score recalculates (5+4+5+4+5+3)/6 = 4.33. (4.33/5.0)*10 = 9 points for rating (was 8 default)
            const scoreRes = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/trust/score/${bobId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(scoreRes.body.data.score).toBe(39); // 30 base + 9 rating points = 39
            // Attempting duplicate rating should fail
            const dupRes = await (0, supertest_1.default)(app_1.default)
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
            (0, vitest_1.expect)(dupRes.status).toBe(409);
            (0, vitest_1.expect)(dupRes.body.error.code).toBe('DUPLICATE_RATING');
        });
        (0, vitest_1.it)('Should reject self-rating', async () => {
            await db_1.prisma.trip.update({
                where: { id: tripId },
                data: { status: client_1.TripStatus.completed },
            });
            const res = await (0, supertest_1.default)(app_1.default)
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
            (0, vitest_1.expect)(res.status).toBe(400);
            (0, vitest_1.expect)(res.body.error.code).toBe('SELF_RATING_FORBIDDEN');
        });
    });
    (0, vitest_1.describe)('GET /api/v1/trust/ratings/user/:userId', () => {
        (0, vitest_1.it)('Should retrieve users ratings and analytics breakdown', async () => {
            await db_1.prisma.trip.update({
                where: { id: tripId },
                data: { status: client_1.TripStatus.completed },
            });
            // Submit a rating
            await (0, supertest_1.default)(app_1.default)
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
            const listRes = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/trust/ratings/user/${bobId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(listRes.status).toBe(200);
            (0, vitest_1.expect)(listRes.body.data.items.length).toBe(1);
            (0, vitest_1.expect)(listRes.body.data.items[0].reliability).toBe(5);
            // Analytics for Bob
            const analyticsRes = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/trust/ratings/user/${bobId}/analytics`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(analyticsRes.status).toBe(200);
            (0, vitest_1.expect)(analyticsRes.body.data.totalRatings).toBe(1);
            (0, vitest_1.expect)(analyticsRes.body.data.categories.reliability).toBe(5);
            (0, vitest_1.expect)(analyticsRes.body.data.categories.socialCompatibility).toBe(4);
        });
    });
    // ─── Identity Verification ──────────────────────────────────────────────────
    (0, vitest_1.describe)('Verification Endpoints', () => {
        (0, vitest_1.it)('Should fetch verification status, request pending state, and transition successfully', async () => {
            // Fetch initial
            const initial = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/trust/verification')
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(initial.status).toBe(200);
            (0, vitest_1.expect)(initial.body.data.phoneStatus).toBe('notStarted');
            // Request government ID verification
            const requestRes = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/trust/verification/request')
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ type: 'governmentId' });
            (0, vitest_1.expect)(requestRes.status).toBe(200);
            (0, vitest_1.expect)(requestRes.body.data.governmentIdStatus).toBe('pending');
            (0, vitest_1.expect)(requestRes.body.data.governmentIdRequestedAt).not.toBeNull();
            // Update government ID status to verified (admin workflow)
            const updateRes = await (0, supertest_1.default)(app_1.default)
                .put(`/api/v1/trust/verification/${aliceId}/status`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ type: 'governmentId', status: 'verified' });
            (0, vitest_1.expect)(updateRes.status).toBe(200);
            (0, vitest_1.expect)(updateRes.body.data.governmentIdStatus).toBe('verified');
            (0, vitest_1.expect)(updateRes.body.data.governmentIdVerifiedAt).not.toBeNull();
            // Check trust score has synced (+25 points)
            const scoreRes = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/trust/score')
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(scoreRes.body.data.score).toBe(63); // 30 base + 8 rating + 25 id = 63
        });
    });
    // ─── Guardians ──────────────────────────────────────────────────────────────
    (0, vitest_1.describe)('Guardian Management', () => {
        (0, vitest_1.it)('Should support full CRUD cycle of trusted guardians', async () => {
            // 1. Add guardian
            const addRes = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/trust/guardians')
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({
                name: 'Sherlock Holmes',
                phone: '+15551234567',
                relationship: 'Detective Companion',
                notes: 'Call for extreme mysteries',
            });
            (0, vitest_1.expect)(addRes.status).toBe(201);
            (0, vitest_1.expect)(addRes.body.data.name).toBe('Sherlock Holmes');
            const guardianId = addRes.body.data.id;
            // Trust score should increase by +10 because guardianCount >= 1
            const scoreRes1 = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/trust/score')
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(scoreRes1.body.data.score).toBe(48); // 38 + 10 = 48
            // 2. List guardians
            const listRes = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/trust/guardians')
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(listRes.status).toBe(200);
            (0, vitest_1.expect)(listRes.body.data.length).toBe(1);
            // 3. Update guardian
            const updateRes = await (0, supertest_1.default)(app_1.default)
                .put(`/api/v1/trust/guardians/${guardianId}`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({
                relationship: 'Best Friend',
                isPrimaryEmergencyContact: true,
            });
            (0, vitest_1.expect)(updateRes.status).toBe(200);
            (0, vitest_1.expect)(updateRes.body.data.relationship).toBe('Best Friend');
            (0, vitest_1.expect)(updateRes.body.data.isPrimaryEmergencyContact).toBe(true);
            // 4. Remove guardian
            const removeRes = await (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/trust/guardians/${guardianId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(removeRes.status).toBe(200);
            // Verify deleted
            const checkList = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/trust/guardians')
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(checkList.body.data.length).toBe(0);
            // Trust score should drop back to 38
            const scoreRes2 = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/trust/score')
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(scoreRes2.body.data.score).toBe(38);
        });
        (0, vitest_1.it)('Should block access to other users guardians', async () => {
            const guardian = await db_1.prisma.guardian.create({
                data: {
                    userId: bobId,
                    name: 'John Watson',
                    phone: '+15557654321',
                    relationship: 'Doctor friend',
                },
            });
            const res = await (0, supertest_1.default)(app_1.default)
                .put(`/api/v1/trust/guardians/${guardian.id}`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ name: 'Hacked Watson' });
            (0, vitest_1.expect)(res.status).toBe(403);
        });
    });
    // ─── Travel Memories ────────────────────────────────────────────────────────
    (0, vitest_1.describe)('Travel Memories', () => {
        (0, vitest_1.it)('Should support creating, updating, visibility rules, and deleting travel memories', async () => {
            // 1. Create public memory
            const addRes = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/trust/memories')
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({
                title: 'Beautiful Yosemite Sunset',
                description: 'Caught a glimpse of gold over the horizon',
                destination: 'Yosemite Park',
                mediaUrl: 'https://images.unsplash.com/sunset.jpg',
                visibility: 'public',
            });
            (0, vitest_1.expect)(addRes.status).toBe(201);
            const memoryId = addRes.body.data.id;
            // Trust score should increase (+2 points)
            const scoreRes1 = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/trust/score')
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(scoreRes1.body.data.score).toBe(40); // 38 + 2 = 40
            // 2. Create private memory
            await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/trust/memories')
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({
                title: 'Private campfire moments',
                description: 'Secrets in Yosemite',
                visibility: 'private',
            });
            // 3. List as self (should return both public and private)
            const selfList = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/trust/memories/user/${aliceId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(selfList.status).toBe(200);
            (0, vitest_1.expect)(selfList.body.data.items.length).toBe(2);
            // 4. List as Bob (should only return public memory)
            const bobList = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/trust/memories/user/${aliceId}`)
                .set('Authorization', `Bearer ${bobToken}`);
            (0, vitest_1.expect)(bobList.status).toBe(200);
            (0, vitest_1.expect)(bobList.body.data.items.length).toBe(1);
            (0, vitest_1.expect)(bobList.body.data.items[0].title).toBe('Beautiful Yosemite Sunset');
            // 5. Update memory
            const updateRes = await (0, supertest_1.default)(app_1.default)
                .put(`/api/v1/trust/memories/${memoryId}`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({
                title: 'Stunning Yosemite Golden Hour',
            });
            (0, vitest_1.expect)(updateRes.status).toBe(200);
            (0, vitest_1.expect)(updateRes.body.data.title).toBe('Stunning Yosemite Golden Hour');
            // 6. Delete memory
            const delRes = await (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/trust/memories/${memoryId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(delRes.status).toBe(200);
            // Verify deletion
            const listAfterDelete = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/trust/memories/user/${aliceId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(listAfterDelete.body.data.items.length).toBe(1);
        });
    });
});
