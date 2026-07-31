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
(0, vitest_1.describe)('🤝 Memberships, Applications & Invitations Integration Tests', () => {
    const emailA = 'alice.members@example.com';
    const emailB = 'bob.members@example.com';
    const emailC = 'charlie.members@example.com';
    const password = 'SecurePassword123';
    let aliceId;
    let aliceToken;
    let bobId;
    let bobToken;
    let charlieId;
    let charlieToken;
    (0, vitest_1.beforeEach)(async () => {
        // Clean up
        await db_1.prisma.tripInvitation.deleteMany({});
        await db_1.prisma.tripApplication.deleteMany({});
        await db_1.prisma.tripMember.deleteMany({});
        await db_1.prisma.trip.deleteMany({});
        await db_1.prisma.refreshToken.deleteMany({});
        await db_1.prisma.session.deleteMany({});
        await db_1.prisma.user.deleteMany({
            where: {
                OR: [
                    { email: emailA },
                    { email: emailB },
                    { email: emailC },
                ],
            },
        });
        // Create Alice (Organizer)
        const regAlice = await (0, supertest_1.default)(app_1.default).post('/api/v1/auth/register').send({
            name: 'Alice Organizer',
            email: emailA,
            password,
            age: 25,
        });
        aliceId = regAlice.body.data.user.id;
        aliceToken = regAlice.body.data.accessToken;
        // Create Bob (Applicant/Invitee)
        const regBob = await (0, supertest_1.default)(app_1.default).post('/api/v1/auth/register').send({
            name: 'Bob Joiner',
            email: emailB,
            password,
            age: 28,
        });
        bobId = regBob.body.data.user.id;
        bobToken = regBob.body.data.accessToken;
        // Create Charlie (Third User)
        const regCharlie = await (0, supertest_1.default)(app_1.default).post('/api/v1/auth/register').send({
            name: 'Charlie Explorer',
            email: emailC,
            password,
            age: 22,
        });
        charlieId = regCharlie.body.data.user.id;
        charlieToken = regCharlie.body.data.accessToken;
    });
    (0, vitest_1.afterAll)(async () => {
        await db_1.prisma.tripInvitation.deleteMany({});
        await db_1.prisma.tripApplication.deleteMany({});
        await db_1.prisma.tripMember.deleteMany({});
        await db_1.prisma.trip.deleteMany({});
        await db_1.prisma.refreshToken.deleteMany({});
        await db_1.prisma.session.deleteMany({});
        await db_1.prisma.user.deleteMany({
            where: {
                OR: [
                    { email: emailA },
                    { email: emailB },
                    { email: emailC },
                ],
            },
        });
        await db_1.prisma.$disconnect();
        await redis_1.redisManager.disconnect();
    });
    (0, vitest_1.describe)('Trip Applications Logic', () => {
        let tripId;
        (0, vitest_1.beforeEach)(async () => {
            // Create a trip with maxMembers = 2
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/trips')
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({
                title: 'Road Trip to Oregon',
                description: 'Fun weekend exploring craters and forests.',
                origin: 'Seattle',
                destination: 'Oregon',
                startDate: '2026-10-01T00:00:00.000Z',
                endDate: '2026-10-05T00:00:00.000Z',
                maxMembers: 2,
            });
            tripId = res.body.data.id;
        });
        (0, vitest_1.it)('Should allow Bob to apply to Alice\'s trip', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/trips/${tripId}/applications`)
                .set('Authorization', `Bearer ${bobToken}`)
                .send({ coverLetter: 'I have a car and can drive!' });
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.status).toBe('pending');
            (0, vitest_1.expect)(res.body.data.message).toBe('I have a car and can drive!');
        });
        (0, vitest_1.it)('Should prevent duplicate applications', async () => {
            // First application
            await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/trips/${tripId}/applications`)
                .set('Authorization', `Bearer ${bobToken}`)
                .send({ message: 'First attempt' });
            // Second application
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/trips/${tripId}/applications`)
                .set('Authorization', `Bearer ${bobToken}`)
                .send({ message: 'Second attempt' });
            (0, vitest_1.expect)(res.status).toBe(400);
            (0, vitest_1.expect)(res.body.error.code).toBe('DUPLICATE_APPLICATION');
        });
        (0, vitest_1.it)('Should allow applicant to cancel their own application', async () => {
            const appRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/trips/${tripId}/applications`)
                .set('Authorization', `Bearer ${bobToken}`)
                .send({ message: 'Please let me join!' });
            const applicationId = appRes.body.data.id;
            const cancelRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/applications/${applicationId}/cancel`)
                .set('Authorization', `Bearer ${bobToken}`);
            (0, vitest_1.expect)(cancelRes.status).toBe(200);
            (0, vitest_1.expect)(cancelRes.body.data.status).toBe('cancelled');
        });
        (0, vitest_1.it)('Should prevent Charlie from cancelling Bob\'s application', async () => {
            const appRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/trips/${tripId}/applications`)
                .set('Authorization', `Bearer ${bobToken}`)
                .send({ message: 'Bob application' });
            const applicationId = appRes.body.data.id;
            const cancelRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/applications/${applicationId}/cancel`)
                .set('Authorization', `Bearer ${charlieToken}`);
            (0, vitest_1.expect)(cancelRes.status).toBe(403);
            (0, vitest_1.expect)(cancelRes.body.error.code).toBe('FORBIDDEN_APPLICATION_ACCESS');
        });
    });
    (0, vitest_1.describe)('Organizer Application Reviews & Capacity Management', () => {
        let tripId;
        let appValId;
        (0, vitest_1.beforeEach)(async () => {
            // Create a trip with maxMembers = 2 (Alice is automatically member 1)
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/trips')
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({
                title: 'Camp Rainier',
                description: 'Camping at Mount Rainier Paradise.',
                origin: 'Seattle',
                destination: 'Mount Rainier',
                startDate: '2026-09-01T00:00:00.000Z',
                endDate: '2026-09-03T00:00:00.000Z',
                maxMembers: 2,
            });
            tripId = res.body.data.id;
            // Bob applies
            const appRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/trips/${tripId}/applications`)
                .set('Authorization', `Bearer ${bobToken}`)
                .send({ message: 'Let us camp!' });
            appValId = appRes.body.data.id;
        });
        (0, vitest_1.it)('Should allow Alice to accept Bob\'s application, updating capacity to full', async () => {
            const reviewRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/applications/${appValId}/accept`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ reviewNotes: 'Welcome aboard!' });
            (0, vitest_1.expect)(reviewRes.status).toBe(200);
            (0, vitest_1.expect)(reviewRes.body.data.status).toBe('accepted');
            (0, vitest_1.expect)(reviewRes.body.data.reviewNotes).toBe('Welcome aboard!');
            // Check if trip status changed to 'full'
            const tripRes = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/trips/${tripId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(tripRes.body.data.status).toBe('full');
            (0, vitest_1.expect)(tripRes.body.data.members.length).toBe(2);
        });
        (0, vitest_1.it)('Should reject application if trip is full', async () => {
            // Alice accepts Bob (filling trip to 2/2)
            await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/applications/${appValId}/accept`)
                .set('Authorization', `Bearer ${aliceToken}`);
            // Charlie applies to full trip
            const applyRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/trips/${tripId}/applications`)
                .set('Authorization', `Bearer ${charlieToken}`)
                .send({ message: 'Can I squeeze in?' });
            (0, vitest_1.expect)(applyRes.status).toBe(400);
            (0, vitest_1.expect)(applyRes.body.error.code).toBe('TRIP_FULL');
        });
        (0, vitest_1.it)('Should reject updates or reviews from non-organizer Charlie', async () => {
            const reviewRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/applications/${appValId}/accept`)
                .set('Authorization', `Bearer ${charlieToken}`);
            (0, vitest_1.expect)(reviewRes.status).toBe(403);
            (0, vitest_1.expect)(reviewRes.body.error.code).toBe('FORBIDDEN_TRIP_ACCESS');
        });
    });
    (0, vitest_1.describe)('Invitations Flow', () => {
        let tripId;
        (0, vitest_1.beforeEach)(async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/trips')
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({
                title: 'Hawaii Beach Tour',
                description: 'Surfing and relaxation in Honolulu.',
                origin: 'Seattle',
                destination: 'Hawaii',
                startDate: '2026-11-01T00:00:00.000Z',
                endDate: '2026-11-10T00:00:00.000Z',
                maxMembers: 3,
            });
            tripId = res.body.data.id;
        });
        (0, vitest_1.it)('Should allow Alice to invite Bob to the trip', async () => {
            const inviteRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/trips/${tripId}/invitations`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ inviteeId: bobId, role: 'member' });
            (0, vitest_1.expect)(inviteRes.status).toBe(201);
            (0, vitest_1.expect)(inviteRes.body.data.status).toBe('pending');
            (0, vitest_1.expect)(inviteRes.body.data.inviteeId).toBe(bobId);
        });
        (0, vitest_1.it)('Should allow Bob to accept the invitation, adding him as a member', async () => {
            const inviteRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/trips/${tripId}/invitations`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ inviteeId: bobId });
            const invitationId = inviteRes.body.data.id;
            const acceptRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/invitations/${invitationId}/accept`)
                .set('Authorization', `Bearer ${bobToken}`);
            (0, vitest_1.expect)(acceptRes.status).toBe(200);
            (0, vitest_1.expect)(acceptRes.body.data.status).toBe('accepted');
            // Verify Bob is now a member
            const tripRes = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/trips/${tripId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(tripRes.body.data.members.some((m) => m.userId === bobId)).toBe(true);
        });
        (0, vitest_1.it)('Should allow Bob to decline the invitation', async () => {
            const inviteRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/trips/${tripId}/invitations`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ inviteeId: bobId });
            const invitationId = inviteRes.body.data.id;
            const declineRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/invitations/${invitationId}/decline`)
                .set('Authorization', `Bearer ${bobToken}`);
            (0, vitest_1.expect)(declineRes.status).toBe(200);
            (0, vitest_1.expect)(declineRes.body.data.status).toBe('rejected'); // Mapped to rejected for Flutter
        });
        (0, vitest_1.it)('Should prevent Bob from responding to an invitation sent to Charlie', async () => {
            const inviteRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/trips/${tripId}/invitations`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ inviteeId: charlieId });
            const invitationId = inviteRes.body.data.id;
            const acceptRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/invitations/${invitationId}/accept`)
                .set('Authorization', `Bearer ${bobToken}`);
            (0, vitest_1.expect)(acceptRes.status).toBe(403);
            (0, vitest_1.expect)(acceptRes.body.error.code).toBe('FORBIDDEN_INVITATION_ACCESS');
        });
    });
    (0, vitest_1.describe)('Membership Administration & Roles', () => {
        let tripId;
        (0, vitest_1.beforeEach)(async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/trips')
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({
                title: 'Canada Cabin Expedition',
                description: 'Off-grid winter cabin in British Columbia.',
                origin: 'Seattle',
                destination: 'Vancouver',
                startDate: '2026-12-01T00:00:00.000Z',
                endDate: '2026-12-05T00:00:00.000Z',
                maxMembers: 5,
            });
            tripId = res.body.data.id;
            // Add Bob directly
            await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/trips/${tripId}/members`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ userId: bobId, role: 'member' });
        });
        (0, vitest_1.it)('Should allow Alice to promote Bob to co-organizer', async () => {
            const promoRes = await (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/trips/${tripId}/members/${bobId}/role`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ role: 'coOrganizer' });
            (0, vitest_1.expect)(promoRes.status).toBe(200);
            (0, vitest_1.expect)(promoRes.body.data.role).toBe('coOrganizer');
        });
        (0, vitest_1.it)('Should allow ownership transfer (promoting Bob to organizer, demoting Alice to co-organizer)', async () => {
            const transferRes = await (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/trips/${tripId}/members/${bobId}/role`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ role: 'organizer' });
            (0, vitest_1.expect)(transferRes.status).toBe(200);
            (0, vitest_1.expect)(transferRes.body.data.role).toBe('organizer');
            // Verify Alice is now demoted to co-organizer
            const tripRes = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/trips/${tripId}`)
                .set('Authorization', `Bearer ${bobToken}`);
            const aliceMember = tripRes.body.data.members.find((m) => m.userId === aliceId);
            (0, vitest_1.expect)(aliceMember.role).toBe('coOrganizer');
        });
        (0, vitest_1.it)('Should allow Bob to leave the trip', async () => {
            const leaveRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/trips/${tripId}/leave`)
                .set('Authorization', `Bearer ${bobToken}`);
            (0, vitest_1.expect)(leaveRes.status).toBe(200);
            // Verify Bob is no longer a member
            const tripRes = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/trips/${tripId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(tripRes.body.data.members.length).toBe(1);
        });
        (0, vitest_1.it)('Should prevent sole organizer Alice from leaving the trip without transferring ownership', async () => {
            const leaveRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/trips/${tripId}/leave`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(leaveRes.status).toBe(400);
            (0, vitest_1.expect)(leaveRes.body.error.code).toBe('SOLE_ORGANIZER_LEAVE_ERROR');
        });
    });
});
