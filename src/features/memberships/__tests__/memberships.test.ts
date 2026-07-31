import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../app';
import { prisma } from '../../../core/db';
import { redisManager } from '../../../core/redis';

describe('🤝 Memberships, Applications & Invitations Integration Tests', () => {
  const emailA = 'alice.members@example.com';
  const emailB = 'bob.members@example.com';
  const emailC = 'charlie.members@example.com';
  const password = 'SecurePassword123';

  let aliceId: string;
  let aliceToken: string;
  let bobId: string;
  let bobToken: string;
  let charlieId: string;
  let charlieToken: string;

  beforeEach(async () => {
    // Clean up
    await prisma.tripInvitation.deleteMany({});
    await prisma.tripApplication.deleteMany({});
    await prisma.tripMember.deleteMany({});
    await prisma.trip.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: emailA },
          { email: emailB },
          { email: emailC },
        ],
      },
    });

    // Create Alice (Organizer)
    const regAlice = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice Organizer',
      email: emailA,
      password,
      age: 25,
    });
    aliceId = regAlice.body.data.user.id;
    aliceToken = regAlice.body.data.accessToken;

    // Create Bob (Applicant/Invitee)
    const regBob = await request(app).post('/api/v1/auth/register').send({
      name: 'Bob Joiner',
      email: emailB,
      password,
      age: 28,
    });
    bobId = regBob.body.data.user.id;
    bobToken = regBob.body.data.accessToken;

    // Create Charlie (Third User)
    const regCharlie = await request(app).post('/api/v1/auth/register').send({
      name: 'Charlie Explorer',
      email: emailC,
      password,
      age: 22,
    });
    charlieId = regCharlie.body.data.user.id;
    charlieToken = regCharlie.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.tripInvitation.deleteMany({});
    await prisma.tripApplication.deleteMany({});
    await prisma.tripMember.deleteMany({});
    await prisma.trip.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: emailA },
          { email: emailB },
          { email: emailC },
        ],
      },
    });
    await prisma.$disconnect();
    await redisManager.disconnect();
  });

  describe('Trip Applications Logic', () => {
    let tripId: string;

    beforeEach(async () => {
      // Create a trip with maxMembers = 2
      const res = await request(app)
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

    it('Should allow Bob to apply to Alice\'s trip', async () => {
      const res = await request(app)
        .post(`/api/v1/trips/${tripId}/applications`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ coverLetter: 'I have a car and can drive!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.message).toBe('I have a car and can drive!');
    });

    it('Should prevent duplicate applications', async () => {
      // First application
      await request(app)
        .post(`/api/v1/trips/${tripId}/applications`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ message: 'First attempt' });

      // Second application
      const res = await request(app)
        .post(`/api/v1/trips/${tripId}/applications`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ message: 'Second attempt' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('DUPLICATE_APPLICATION');
    });

    it('Should allow applicant to cancel their own application', async () => {
      const appRes = await request(app)
        .post(`/api/v1/trips/${tripId}/applications`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ message: 'Please let me join!' });
      const applicationId = appRes.body.data.id;

      const cancelRes = await request(app)
        .post(`/api/v1/applications/${applicationId}/cancel`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('cancelled');
    });

    it('Should prevent Charlie from cancelling Bob\'s application', async () => {
      const appRes = await request(app)
        .post(`/api/v1/trips/${tripId}/applications`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ message: 'Bob application' });
      const applicationId = appRes.body.data.id;

      const cancelRes = await request(app)
        .post(`/api/v1/applications/${applicationId}/cancel`)
        .set('Authorization', `Bearer ${charlieToken}`);

      expect(cancelRes.status).toBe(403);
      expect(cancelRes.body.error.code).toBe('FORBIDDEN_APPLICATION_ACCESS');
    });
  });

  describe('Organizer Application Reviews & Capacity Management', () => {
    let tripId: string;
    let appValId: string;

    beforeEach(async () => {
      // Create a trip with maxMembers = 2 (Alice is automatically member 1)
      const res = await request(app)
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
      const appRes = await request(app)
        .post(`/api/v1/trips/${tripId}/applications`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ message: 'Let us camp!' });
      appValId = appRes.body.data.id;
    });

    it('Should allow Alice to accept Bob\'s application, updating capacity to full', async () => {
      const reviewRes = await request(app)
        .post(`/api/v1/applications/${appValId}/accept`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ reviewNotes: 'Welcome aboard!' });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.status).toBe('accepted');
      expect(reviewRes.body.data.reviewNotes).toBe('Welcome aboard!');

      // Check if trip status changed to 'full'
      const tripRes = await request(app)
        .get(`/api/v1/trips/${tripId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(tripRes.body.data.status).toBe('full');
      expect(tripRes.body.data.members.length).toBe(2);
    });

    it('Should reject application if trip is full', async () => {
      // Alice accepts Bob (filling trip to 2/2)
      await request(app)
        .post(`/api/v1/applications/${appValId}/accept`)
        .set('Authorization', `Bearer ${aliceToken}`);

      // Charlie applies to full trip
      const applyRes = await request(app)
        .post(`/api/v1/trips/${tripId}/applications`)
        .set('Authorization', `Bearer ${charlieToken}`)
        .send({ message: 'Can I squeeze in?' });

      expect(applyRes.status).toBe(400);
      expect(applyRes.body.error.code).toBe('TRIP_FULL');
    });

    it('Should reject updates or reviews from non-organizer Charlie', async () => {
      const reviewRes = await request(app)
        .post(`/api/v1/applications/${appValId}/accept`)
        .set('Authorization', `Bearer ${charlieToken}`);

      expect(reviewRes.status).toBe(403);
      expect(reviewRes.body.error.code).toBe('FORBIDDEN_TRIP_ACCESS');
    });
  });

  describe('Invitations Flow', () => {
    let tripId: string;

    beforeEach(async () => {
      const res = await request(app)
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

    it('Should allow Alice to invite Bob to the trip', async () => {
      const inviteRes = await request(app)
        .post(`/api/v1/trips/${tripId}/invitations`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ inviteeId: bobId, role: 'member' });

      expect(inviteRes.status).toBe(201);
      expect(inviteRes.body.data.status).toBe('pending');
      expect(inviteRes.body.data.inviteeId).toBe(bobId);
    });

    it('Should allow Bob to accept the invitation, adding him as a member', async () => {
      const inviteRes = await request(app)
        .post(`/api/v1/trips/${tripId}/invitations`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ inviteeId: bobId });
      const invitationId = inviteRes.body.data.id;

      const acceptRes = await request(app)
        .post(`/api/v1/invitations/${invitationId}/accept`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.status).toBe('accepted');

      // Verify Bob is now a member
      const tripRes = await request(app)
        .get(`/api/v1/trips/${tripId}`)
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(tripRes.body.data.members.some((m: any) => m.userId === bobId)).toBe(true);
    });

    it('Should allow Bob to decline the invitation', async () => {
      const inviteRes = await request(app)
        .post(`/api/v1/trips/${tripId}/invitations`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ inviteeId: bobId });
      const invitationId = inviteRes.body.data.id;

      const declineRes = await request(app)
        .post(`/api/v1/invitations/${invitationId}/decline`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(declineRes.status).toBe(200);
      expect(declineRes.body.data.status).toBe('rejected'); // Mapped to rejected for Flutter
    });

    it('Should prevent Bob from responding to an invitation sent to Charlie', async () => {
      const inviteRes = await request(app)
        .post(`/api/v1/trips/${tripId}/invitations`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ inviteeId: charlieId });
      const invitationId = inviteRes.body.data.id;

      const acceptRes = await request(app)
        .post(`/api/v1/invitations/${invitationId}/accept`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(acceptRes.status).toBe(403);
      expect(acceptRes.body.error.code).toBe('FORBIDDEN_INVITATION_ACCESS');
    });
  });

  describe('Membership Administration & Roles', () => {
    let tripId: string;

    beforeEach(async () => {
      const res = await request(app)
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
      await request(app)
        .post(`/api/v1/trips/${tripId}/members`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ userId: bobId, role: 'member' });
    });

    it('Should allow Alice to promote Bob to co-organizer', async () => {
      const promoRes = await request(app)
        .patch(`/api/v1/trips/${tripId}/members/${bobId}/role`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ role: 'coOrganizer' });

      expect(promoRes.status).toBe(200);
      expect(promoRes.body.data.role).toBe('coOrganizer');
    });

    it('Should allow ownership transfer (promoting Bob to organizer, demoting Alice to co-organizer)', async () => {
      const transferRes = await request(app)
        .patch(`/api/v1/trips/${tripId}/members/${bobId}/role`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ role: 'organizer' });

      expect(transferRes.status).toBe(200);
      expect(transferRes.body.data.role).toBe('organizer');

      // Verify Alice is now demoted to co-organizer
      const tripRes = await request(app)
        .get(`/api/v1/trips/${tripId}`)
        .set('Authorization', `Bearer ${bobToken}`);

      const aliceMember = tripRes.body.data.members.find((m: any) => m.userId === aliceId);
      expect(aliceMember.role).toBe('coOrganizer');
    });

    it('Should allow Bob to leave the trip', async () => {
      const leaveRes = await request(app)
        .post(`/api/v1/trips/${tripId}/leave`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(leaveRes.status).toBe(200);

      // Verify Bob is no longer a member
      const tripRes = await request(app)
        .get(`/api/v1/trips/${tripId}`)
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(tripRes.body.data.members.length).toBe(1);
    });

    it('Should prevent sole organizer Alice from leaving the trip without transferring ownership', async () => {
      const leaveRes = await request(app)
        .post(`/api/v1/trips/${tripId}/leave`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(leaveRes.status).toBe(400);
      expect(leaveRes.body.error.code).toBe('SOLE_ORGANIZER_LEAVE_ERROR');
    });
  });
});
