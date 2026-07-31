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
(0, vitest_1.describe)('🔐 Authentication Endpoints API Integration Tests', () => {
    const testEmail = 'testing.user@example.com';
    const testPassword = 'SecurePassword123';
    // Ensure clean DB before each test
    (0, vitest_1.beforeEach)(async () => {
        await db_1.prisma.refreshToken.deleteMany({});
        await db_1.prisma.session.deleteMany({});
        await db_1.prisma.user.deleteMany({
            where: { email: testEmail },
        });
    });
    (0, vitest_1.afterAll)(async () => {
        // Cleanup DB users and close connections
        await db_1.prisma.refreshToken.deleteMany({});
        await db_1.prisma.session.deleteMany({});
        await db_1.prisma.user.deleteMany({
            where: { email: testEmail },
        });
        await db_1.prisma.$disconnect();
        await redis_1.redisManager.disconnect();
    });
    (0, vitest_1.it)('1. POST /api/v1/auth/register - Should register a new user successfully', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/register')
            .send({
            name: 'Test Runner',
            email: testEmail,
            password: testPassword,
            age: 25,
            deviceId: 'test-device-uuid',
        });
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.success).toBe(true);
        (0, vitest_1.expect)(res.body.data.user.email).toBe(testEmail);
        (0, vitest_1.expect)(res.body.data.user.name).toBe('Test Runner');
        (0, vitest_1.expect)(res.body.data).toHaveProperty('accessToken');
        (0, vitest_1.expect)(res.body.data).toHaveProperty('refreshToken');
        // Confirm DB write
        const dbUser = await db_1.prisma.user.findUnique({ where: { email: testEmail } });
        (0, vitest_1.expect)(dbUser).not.toBeNull();
    });
    (0, vitest_1.it)('2. POST /api/v1/auth/register - Should fail if email is already taken', async () => {
        // Register first user
        await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/register')
            .send({
            name: 'Test Runner',
            email: testEmail,
            password: testPassword,
            age: 25,
        });
        // Attempt second registration
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/register')
            .send({
            name: 'Duplicate Runner',
            email: testEmail,
            password: 'anotherPassword123',
            age: 28,
        });
        (0, vitest_1.expect)(res.status).toBe(409);
        (0, vitest_1.expect)(res.body.success).toBe(false);
        (0, vitest_1.expect)(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });
    (0, vitest_1.it)('3. POST /api/v1/auth/login - Should login with correct credentials', async () => {
        // Register first
        await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/register')
            .send({
            name: 'Test Runner',
            email: testEmail,
            password: testPassword,
            age: 25,
        });
        // Login
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/login')
            .send({
            email: testEmail,
            password: testPassword,
            deviceId: 'test-device-uuid',
        });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.success).toBe(true);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('accessToken');
        (0, vitest_1.expect)(res.body.data).toHaveProperty('refreshToken');
    });
    (0, vitest_1.it)('4. POST /api/v1/auth/login - Should fail with incorrect password', async () => {
        await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/register')
            .send({
            name: 'Test Runner',
            email: testEmail,
            password: testPassword,
            age: 25,
        });
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/login')
            .send({
            email: testEmail,
            password: 'WrongPassword123',
        });
        (0, vitest_1.expect)(res.status).toBe(401);
        (0, vitest_1.expect)(res.body.success).toBe(false);
        (0, vitest_1.expect)(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
    (0, vitest_1.it)('5. GET /api/v1/users/me - Should fetch profile with valid access token', async () => {
        // Register and get access token
        const regRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/register')
            .send({
            name: 'Test Runner',
            email: testEmail,
            password: testPassword,
            age: 25,
        });
        const accessToken = regRes.body.data.accessToken;
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/v1/users/me')
            .set('Authorization', `Bearer ${accessToken}`);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.success).toBe(true);
        (0, vitest_1.expect)(res.body.data.user.email).toBe(testEmail);
        (0, vitest_1.expect)(res.body.data.user.name).toBe('Test Runner');
    });
    (0, vitest_1.it)('6. GET /api/v1/users/me - Should block requests with missing or expired token', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/v1/users/me');
        (0, vitest_1.expect)(res.status).toBe(401);
        (0, vitest_1.expect)(res.body.success).toBe(false);
        (0, vitest_1.expect)(res.body.error.code).toBe('TOKEN_MISSING');
    });
    (0, vitest_1.it)('7. POST /api/v1/auth/refresh - Should rotate and issue new tokens', async () => {
        const regRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/register')
            .send({
            name: 'Test Runner',
            email: testEmail,
            password: testPassword,
            age: 25,
        });
        const refreshToken = regRes.body.data.refreshToken;
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.success).toBe(true);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('accessToken');
        (0, vitest_1.expect)(res.body.data).toHaveProperty('refreshToken');
        // Attempting to reuse old refresh token should fail (token rotation)
        const reuseRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken });
        (0, vitest_1.expect)(reuseRes.status).toBe(401);
        (0, vitest_1.expect)(reuseRes.body.success).toBe(false);
    });
    (0, vitest_1.it)('8. POST /api/v1/auth/logout - Should end active session', async () => {
        const regRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/register')
            .send({
            name: 'Test Runner',
            email: testEmail,
            password: testPassword,
            age: 25,
        });
        const { accessToken, refreshToken } = regRes.body.data;
        // Logout
        const logoutRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/logout')
            .set('Authorization', `Bearer ${accessToken}`);
        (0, vitest_1.expect)(logoutRes.status).toBe(200);
        (0, vitest_1.expect)(logoutRes.body.success).toBe(true);
        // Verify session removed from database
        const profileRes = await (0, supertest_1.default)(app_1.default)
            .get('/api/v1/users/me')
            .set('Authorization', `Bearer ${accessToken}`);
        (0, vitest_1.expect)(profileRes.status).toBe(401);
        // Refresh should also fail
        const refreshRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken });
        (0, vitest_1.expect)(refreshRes.status).toBe(401);
    });
});
