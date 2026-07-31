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
(0, vitest_1.describe)('👤 Users & Profiles Endpoints API Integration Tests', () => {
    const emailA = 'alice.test@example.com';
    const emailB = 'bob.test@example.com';
    const password = 'SecurePassword123';
    let aliceId;
    let aliceToken;
    let bobId;
    let bobToken;
    (0, vitest_1.beforeEach)(async () => {
        // Clean up test users
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
    });
    (0, vitest_1.afterAll)(async () => {
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
    (0, vitest_1.describe)('GET /api/v1/profiles/:userId', () => {
        (0, vitest_1.it)('Should retrieve Alice public flat profile successfully', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/profiles/${aliceId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.userId).toBe(aliceId);
            (0, vitest_1.expect)(res.body.data.name).toBe('Alice Cooper');
            (0, vitest_1.expect)(res.body.data.email).toBe(emailA);
            (0, vitest_1.expect)(res.body.data.age).toBe(26);
            (0, vitest_1.expect)(res.body.data).toHaveProperty('statistics');
            (0, vitest_1.expect)(res.body.data.statistics.completedTrips).toBe(0);
        });
        (0, vitest_1.it)('Should fail with 404 for non-existing user profile', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/profiles/non-existent-user-id')
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(res.status).toBe(404);
            (0, vitest_1.expect)(res.body.success).toBe(false);
            (0, vitest_1.expect)(res.body.error.code).toBe('PROFILE_NOT_FOUND');
        });
    });
    (0, vitest_1.describe)('PUT /api/v1/profiles/:userId', () => {
        (0, vitest_1.it)('Should allow Alice to update her own profile details', async () => {
            const updateData = {
                name: 'Alice C.',
                username: 'alice_cooper',
                bio: 'Explorer of wild forests and deep oceans',
                location: 'Seattle, USA',
                interests: ['Hiking', 'Scuba', 'Camping'],
                travelStyles: ['Adventure', 'Nature'],
                budgetPreference: 'budget',
                languages: ['English', 'Spanish'],
            };
            const res = await (0, supertest_1.default)(app_1.default)
                .put(`/api/v1/profiles/${aliceId}`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send(updateData);
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.name).toBe('Alice C.');
            (0, vitest_1.expect)(res.body.data.username).toBe('alice_cooper');
            (0, vitest_1.expect)(res.body.data.bio).toBe('Explorer of wild forests and deep oceans');
            (0, vitest_1.expect)(res.body.data.location).toBe('Seattle, USA');
            (0, vitest_1.expect)(res.body.data.interests).toEqual(['Hiking', 'Scuba', 'Camping']);
            (0, vitest_1.expect)(res.body.data.budgetPreference).toBe('budget');
        });
        (0, vitest_1.it)('Should reject updates to Bob profile by Alice (Forbidden)', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .put(`/api/v1/profiles/${bobId}`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ name: 'Hack Bob' });
            (0, vitest_1.expect)(res.status).toBe(403);
            (0, vitest_1.expect)(res.body.success).toBe(false);
            (0, vitest_1.expect)(res.body.error.code).toBe('FORBIDDEN_PROFILE_UPDATE');
        });
        (0, vitest_1.it)('Should reject username if already taken', async () => {
            // Alice claims 'traveler_one'
            await (0, supertest_1.default)(app_1.default)
                .put(`/api/v1/profiles/${aliceId}`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ username: 'traveler_one' });
            // Bob attempts to claim 'traveler_one'
            const res = await (0, supertest_1.default)(app_1.default)
                .put(`/api/v1/profiles/${bobId}`)
                .set('Authorization', `Bearer ${bobToken}`)
                .send({ username: 'traveler_one' });
            (0, vitest_1.expect)(res.status).toBe(409);
            (0, vitest_1.expect)(res.body.success).toBe(false);
            (0, vitest_1.expect)(res.body.error.code).toBe('USERNAME_ALREADY_EXISTS');
        });
        (0, vitest_1.it)('Should reject invalid fields (Validation Failure)', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .put(`/api/v1/profiles/${aliceId}`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({
                avatarUrl: 'not-a-valid-url',
                age: 12, // too young
            });
            (0, vitest_1.expect)(res.status).toBe(400);
            (0, vitest_1.expect)(res.body.success).toBe(false);
            (0, vitest_1.expect)(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });
    (0, vitest_1.describe)('GET /api/v1/profiles (Search)', () => {
        (0, vitest_1.it)('Should return paginated matching profiles on search parameters', async () => {
            // Set unique usernames/locations first
            await (0, supertest_1.default)(app_1.default)
                .put(`/api/v1/profiles/${aliceId}`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ username: 'alice_super_traveler', budgetPreference: 'budget', location: 'Paris' });
            await (0, supertest_1.default)(app_1.default)
                .put(`/api/v1/profiles/${bobId}`)
                .set('Authorization', `Bearer ${bobToken}`)
                .send({ username: 'bob_chill_traveler', budgetPreference: 'luxury', location: 'London' });
            // Search matching 'traveler'
            const searchRes = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/profiles')
                .query({ query: 'traveler' })
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(searchRes.status).toBe(200);
            (0, vitest_1.expect)(searchRes.body.success).toBe(true);
            const matchingTestUsers = searchRes.body.data.profiles.filter((p) => p.userId === aliceId || p.userId === bobId);
            (0, vitest_1.expect)(matchingTestUsers.length).toBe(2);
            // Search matching budgetPreference 'luxury'
            const budgetRes = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/profiles')
                .query({ budgetPreference: 'luxury' })
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(budgetRes.status).toBe(200);
            const luxuryTestUsers = budgetRes.body.data.profiles.filter((p) => p.userId === aliceId || p.userId === bobId);
            (0, vitest_1.expect)(luxuryTestUsers.length).toBe(1);
            (0, vitest_1.expect)(luxuryTestUsers[0].userId).toBe(bobId);
        });
    });
    (0, vitest_1.describe)('GET /api/v1/users/:id', () => {
        (0, vitest_1.it)('Should fetch user details by ID successfully', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${bobId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.user.id).toBe(bobId);
            (0, vitest_1.expect)(res.body.data.user.email).toBe(emailB);
        });
    });
    (0, vitest_1.describe)('DELETE /api/v1/users/:id (Soft Delete)', () => {
        (0, vitest_1.it)('Should allow user to soft delete their own account and block login', async () => {
            const deleteRes = await (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/users/${aliceId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(deleteRes.status).toBe(200);
            (0, vitest_1.expect)(deleteRes.body.success).toBe(true);
            // Verify db state
            const dbUser = await db_1.prisma.user.findUnique({
                where: { id: aliceId },
            });
            (0, vitest_1.expect)(dbUser?.isDeleted).toBe(true);
            (0, vitest_1.expect)(dbUser?.deletedAt).not.toBeNull();
            // Subsequent api requests with Alice token should be blocked
            const meRes = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/users/me')
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(meRes.status).toBe(401);
            // Login should also fail
            const loginRes = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/login')
                .send({
                email: emailA,
                password,
            });
            (0, vitest_1.expect)(loginRes.status).toBe(401);
        });
        (0, vitest_1.it)('Should block Alice from deleting Bob account (Forbidden)', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/users/${bobId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(res.status).toBe(403);
            (0, vitest_1.expect)(res.body.success).toBe(false);
            (0, vitest_1.expect)(res.body.error.code).toBe('FORBIDDEN_USER_DELETE');
        });
    });
});
