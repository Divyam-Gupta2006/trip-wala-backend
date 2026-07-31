import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import app from '../../../app';
import { prisma } from '../../../core/db';
import { redisManager } from '../../../core/redis';
import { initSocketServer } from '../socket.handler';

describe('💬 Messaging & Real-Time Communication Integration Tests', () => {
  const emailA = 'alice.chat@example.com';
  const emailB = 'bob.chat@example.com';
  const emailC = 'charlie.chat@example.com';
  const password = 'SecurePassword123';

  let aliceId: string;
  let aliceToken: string;
  let bobId: string;
  let bobToken: string;
  let charlieId: string;
  let charlieToken: string;

  let server: any;
  let ioServer: any;
  let port: number;
  let socketClients: ClientSocket[] = [];

  function createSocketClient(token: string): ClientSocket {
    const client = Client(`http://localhost:${port}`, {
      auth: { token: `Bearer ${token}` },
      transports: ['websocket'],
      forceNew: true,
    });
    socketClients.push(client);
    return client;
  }

  beforeAll(async () => {
    // 1. Connect Redis and wait for ready
    const redis = redisManager.connect();
    if (redis.status !== 'ready') {
      await new Promise<void>((resolve) => {
        redis.once('ready', () => resolve());
      });
    }

    // 2. Start ephemeral server
    await new Promise<void>((resolve) => {
      server = createServer(app);
      ioServer = initSocketServer(server);
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  beforeEach(async () => {
    // Disconnect any active client sockets
    for (const socket of socketClients) {
      if (socket.connected) socket.disconnect();
    }
    socketClients = [];

    // Clean up DB records
    await prisma.message.deleteMany({});
    await prisma.conversationParticipant.deleteMany({});
    await prisma.conversation.deleteMany({});
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

    // Create Alice
    const regAlice = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice Chat',
      email: emailA,
      password,
      age: 26,
    });
    aliceId = regAlice.body.data.user.id;
    aliceToken = regAlice.body.data.accessToken;

    // Create Bob
    const regBob = await request(app).post('/api/v1/auth/register').send({
      name: 'Bob Chat',
      email: emailB,
      password,
      age: 29,
    });
    bobId = regBob.body.data.user.id;
    bobToken = regBob.body.data.accessToken;

    // Create Charlie
    const regCharlie = await request(app).post('/api/v1/auth/register').send({
      name: 'Charlie Chat',
      email: emailC,
      password,
      age: 23,
    });
    charlieId = regCharlie.body.data.user.id;
    charlieToken = regCharlie.body.data.accessToken;

    // Clean presence status in Redis for test users
    const redis = redisManager.getClient();
    await redis.del(`presence:user:${aliceId}`);
    await redis.del(`presence:user:${bobId}`);
    await redis.del(`presence:status:${aliceId}`);
    await redis.del(`presence:status:${bobId}`);
  });

  afterAll(async () => {
    for (const socket of socketClients) {
      if (socket.connected) socket.disconnect();
    }
    await prisma.message.deleteMany({});
    await prisma.conversationParticipant.deleteMany({});
    await prisma.conversation.deleteMany({});
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
    ioServer.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
    await redisManager.disconnect();
  });

  describe('REST APIs: Conversation & Message CRUD', () => {
    it('Should allow resolving and creating a direct conversation between Alice and Bob', async () => {
      // 1. Resolve direct chat between Alice and Bob
      const res = await request(app)
        .post('/api/v1/conversations/direct')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ targetUserId: bobId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Bob Chat');

      // 2. Fetch conversations for Alice
      const listRes = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.data[0].id).toBe(res.body.data.id);
    });

    it('Should enforce that unauthorized users cannot read messages in a conversation', async () => {
      // 1. Alice creates direct conversation with Bob
      const convRes = await request(app)
        .post('/api/v1/conversations/direct')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ targetUserId: bobId });
      const convId = convRes.body.data.id;

      // 2. Charlie attempts to fetch message history for this conversation
      const readRes = await request(app)
        .get(`/api/v1/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${charlieToken}`);

      expect(readRes.status).toBe(403);
      expect(readRes.body.error.code).toBe('FORBIDDEN_CHAT_ACCESS');
    });

    it('Should support sending, editing, deleting, and reacting to messages via REST', async () => {
      // 1. Resolve conversation
      const convRes = await request(app)
        .post('/api/v1/conversations/direct')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ targetUserId: bobId });
      const convId = convRes.body.data.id;

      // 2. Send message via REST
      const sendRes = await request(app)
        .post(`/api/v1/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ text: 'Hello Bob!' });

      expect(sendRes.status).toBe(201);
      expect(sendRes.body.data.text).toBe('Hello Bob!');
      const messageId = sendRes.body.data.id;

      // 3. Edit message
      const editRes = await request(app)
        .put(`/api/v1/conversations/messages/${messageId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ text: 'Hello Bob! (edited)' });

      expect(editRes.status).toBe(200);
      expect(editRes.body.data.text).toBe('Hello Bob! (edited)');

      // 4. Toggle Emoji reaction
      const reactRes = await request(app)
        .post(`/api/v1/conversations/messages/${messageId}/react`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ emoji: 'thumbs_up' });

      expect(reactRes.status).toBe(200);
      expect(reactRes.body.data.reactions['thumbs_up']).toContain(bobId);

      // 5. Delete message
      const deleteRes = await request(app)
        .delete(`/api/v1/conversations/messages/${messageId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.text).toBe('This message was deleted.');
    });

    it('Should handle unread counters and marking conversations as read', async () => {
      // 1. Resolve conversation
      const convRes = await request(app)
        .post('/api/v1/conversations/direct')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ targetUserId: bobId });
      const convId = convRes.body.data.id;

      // 2. Bob sends two messages
      await request(app)
        .post(`/api/v1/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ text: 'Message 1' });
      await request(app)
        .post(`/api/v1/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ text: 'Message 2' });

      // 3. Alice gets her unread counts
      const countRes = await request(app)
        .get('/api/v1/conversations/unread-count')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(countRes.status).toBe(200);
      expect(countRes.body.data.unreadCount).toBe(2);

      // 4. Alice marks the conversation as read
      await request(app)
        .post(`/api/v1/conversations/${convId}/read`)
        .set('Authorization', `Bearer ${aliceToken}`);

      // 5. Unread count becomes 0
      const countRes2 = await request(app)
        .get('/api/v1/conversations/unread-count')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(countRes2.body.data.unreadCount).toBe(0);
    });
  });

  describe('Socket.IO Real-Time Engine', () => {
    it('Should allow connection with a valid token, tracking presence status in Redis', async () => {
      const client = createSocketClient(aliceToken);

      await new Promise<void>((resolve, reject) => {
        client.on('connect', resolve);
        client.on('connect_error', reject);
      });

      expect(client.connected).toBe(true);

      // Wait a brief moment for the server-side async connection event handler to write to Redis
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify status is online in Redis
      const redis = redisManager.getClient();
      const status = await redis.get(`presence:status:${aliceId}`);
      expect(status).toBe('online');

      // Disconnect
      client.disconnect();

      // Wait a brief moment for status update
      await new Promise((resolve) => setTimeout(resolve, 100));
      const statusOffline = await redis.get(`presence:status:${aliceId}`);
      expect(statusOffline).toBeNull();
    });

    it('Should prevent connection with an invalid token', async () => {
      const client = createSocketClient('InvalidTokenHere');

      const errorOccurred = await new Promise<boolean>((resolve) => {
        client.on('connect_error', () => resolve(true));
      });

      expect(errorOccurred).toBe(true);
      expect(client.connected).toBe(false);
    });

    it('Should restrict room join based on conversation/trip membership', async () => {
      // 1. Create a trip with Alice as organizer
      const tripRes = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          title: 'Maui Adventure',
          description: 'Fun on the Maui beaches.',
          origin: 'Honolulu',
          destination: 'Maui',
          startDate: '2026-10-01T00:00:00.000Z',
          endDate: '2026-10-05T00:00:00.000Z',
          maxMembers: 4,
        });
      const tripId = tripRes.body.data.id;

      // 2. Connect Bob and try to join the Hawaii trip group chat room
      const bobClient = createSocketClient(bobToken);
      await new Promise<void>((resolve) => {
        bobClient.on('connect', resolve);
      });

      const joinRes = await new Promise<any>((resolve) => {
        bobClient.emit('join_room', { roomId: tripId }, resolve);
      });

      expect(joinRes.success).toBe(false);
      expect(joinRes.error).toContain('You must be a member of the trip');
    });

    it('Should broadcast send_message to all room members', async () => {
      // 1. Alice creates direct conversation with Bob
      const convRes = await request(app)
        .post('/api/v1/conversations/direct')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ targetUserId: bobId });
      const convId = convRes.body.data.id;

      // 2. Connect Alice and Bob to Socket server and join the room
      const aliceClient = createSocketClient(aliceToken);
      const bobClient = createSocketClient(bobToken);

      await Promise.all([
        new Promise<void>((resolve) => aliceClient.on('connect', resolve)),
        new Promise<void>((resolve) => bobClient.on('connect', resolve)),
      ]);

      await Promise.all([
        new Promise<void>((resolve) => aliceClient.emit('join_room', { roomId: convId }, () => resolve())),
        new Promise<void>((resolve) => bobClient.emit('join_room', { roomId: convId }, () => resolve())),
      ]);

      // 3. Bob sends a message, Alice expects to receive new_message event
      const msgPromise = new Promise<any>((resolve) => {
        aliceClient.on('new_message', resolve);
      });

      bobClient.emit('send_message', {
        chatId: convId,
        text: 'Socket communication is live!',
      });

      const receivedMsg = await msgPromise;
      expect(receivedMsg.text).toBe('Socket communication is live!');
      expect(receivedMsg.senderId).toBe(bobId);
    });

    it('Should broadcast typing indicators', async () => {
      const convRes = await request(app)
        .post('/api/v1/conversations/direct')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ targetUserId: bobId });
      const convId = convRes.body.data.id;

      const aliceClient = createSocketClient(aliceToken);
      const bobClient = createSocketClient(bobToken);

      await Promise.all([
        new Promise<void>((resolve) => aliceClient.on('connect', resolve)),
        new Promise<void>((resolve) => bobClient.on('connect', resolve)),
      ]);

      await Promise.all([
        new Promise<void>((resolve) => aliceClient.emit('join_room', { roomId: convId }, () => resolve())),
        new Promise<void>((resolve) => bobClient.emit('join_room', { roomId: convId }, () => resolve())),
      ]);

      const typingPromise = new Promise<any>((resolve) => {
        bobClient.on('user_typing', resolve);
      });

      aliceClient.emit('typing', {
        roomId: convId,
        isTyping: true,
      });

      const typingEvent = await typingPromise;
      expect(typingEvent.roomId).toBe(convId);
      expect(typingEvent.userId).toBe(aliceId);
      expect(typingEvent.isTyping).toBe(true);
    });
  });
});
