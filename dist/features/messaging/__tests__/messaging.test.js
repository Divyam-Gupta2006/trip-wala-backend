"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const http_1 = require("http");
const socket_io_client_1 = require("socket.io-client");
const app_1 = __importDefault(require("../../../app"));
const db_1 = require("../../../core/db");
const redis_1 = require("../../../core/redis");
const socket_handler_1 = require("../socket.handler");
(0, vitest_1.describe)('💬 Messaging & Real-Time Communication Integration Tests', () => {
    const emailA = 'alice.chat@example.com';
    const emailB = 'bob.chat@example.com';
    const emailC = 'charlie.chat@example.com';
    const password = 'SecurePassword123';
    let aliceId;
    let aliceToken;
    let bobId;
    let bobToken;
    let charlieId;
    let charlieToken;
    let server;
    let ioServer;
    let port;
    let socketClients = [];
    function createSocketClient(token) {
        const client = (0, socket_io_client_1.io)(`http://localhost:${port}`, {
            auth: { token: `Bearer ${token}` },
            transports: ['websocket'],
            forceNew: true,
        });
        socketClients.push(client);
        return client;
    }
    (0, vitest_1.beforeAll)(async () => {
        // 1. Connect Redis and wait for ready
        const redis = redis_1.redisManager.connect();
        if (redis.status !== 'ready') {
            await new Promise((resolve) => {
                redis.once('ready', () => resolve());
            });
        }
        // 2. Start ephemeral server
        await new Promise((resolve) => {
            server = (0, http_1.createServer)(app_1.default);
            ioServer = (0, socket_handler_1.initSocketServer)(server);
            server.listen(0, () => {
                port = server.address().port;
                resolve();
            });
        });
    });
    (0, vitest_1.beforeEach)(async () => {
        // Disconnect any active client sockets
        for (const socket of socketClients) {
            if (socket.connected)
                socket.disconnect();
        }
        socketClients = [];
        // Clean up DB records
        await db_1.prisma.message.deleteMany({});
        await db_1.prisma.conversationParticipant.deleteMany({});
        await db_1.prisma.conversation.deleteMany({});
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
        // Create Alice
        const regAlice = await (0, supertest_1.default)(app_1.default).post('/api/v1/auth/register').send({
            name: 'Alice Chat',
            email: emailA,
            password,
            age: 26,
        });
        aliceId = regAlice.body.data.user.id;
        aliceToken = regAlice.body.data.accessToken;
        // Create Bob
        const regBob = await (0, supertest_1.default)(app_1.default).post('/api/v1/auth/register').send({
            name: 'Bob Chat',
            email: emailB,
            password,
            age: 29,
        });
        bobId = regBob.body.data.user.id;
        bobToken = regBob.body.data.accessToken;
        // Create Charlie
        const regCharlie = await (0, supertest_1.default)(app_1.default).post('/api/v1/auth/register').send({
            name: 'Charlie Chat',
            email: emailC,
            password,
            age: 23,
        });
        charlieId = regCharlie.body.data.user.id;
        charlieToken = regCharlie.body.data.accessToken;
        // Clean presence status in Redis for test users
        const redis = redis_1.redisManager.getClient();
        await redis.del(`presence:user:${aliceId}`);
        await redis.del(`presence:user:${bobId}`);
        await redis.del(`presence:status:${aliceId}`);
        await redis.del(`presence:status:${bobId}`);
    });
    (0, vitest_1.afterAll)(async () => {
        for (const socket of socketClients) {
            if (socket.connected)
                socket.disconnect();
        }
        await db_1.prisma.message.deleteMany({});
        await db_1.prisma.conversationParticipant.deleteMany({});
        await db_1.prisma.conversation.deleteMany({});
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
        ioServer.close();
        await new Promise((resolve) => server.close(() => resolve()));
        await db_1.prisma.$disconnect();
        await redis_1.redisManager.disconnect();
    });
    (0, vitest_1.describe)('REST APIs: Conversation & Message CRUD', () => {
        (0, vitest_1.it)('Should allow resolving and creating a direct conversation between Alice and Bob', async () => {
            // 1. Resolve direct chat between Alice and Bob
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/conversations/direct')
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ targetUserId: bobId });
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.name).toBe('Bob Chat');
            // 2. Fetch conversations for Alice
            const listRes = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/conversations')
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(listRes.status).toBe(200);
            (0, vitest_1.expect)(listRes.body.data.length).toBe(1);
            (0, vitest_1.expect)(listRes.body.data[0].id).toBe(res.body.data.id);
        });
        (0, vitest_1.it)('Should enforce that unauthorized users cannot read messages in a conversation', async () => {
            // 1. Alice creates direct conversation with Bob
            const convRes = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/conversations/direct')
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ targetUserId: bobId });
            const convId = convRes.body.data.id;
            // 2. Charlie attempts to fetch message history for this conversation
            const readRes = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/conversations/${convId}/messages`)
                .set('Authorization', `Bearer ${charlieToken}`);
            (0, vitest_1.expect)(readRes.status).toBe(403);
            (0, vitest_1.expect)(readRes.body.error.code).toBe('FORBIDDEN_CHAT_ACCESS');
        });
        (0, vitest_1.it)('Should support sending, editing, deleting, and reacting to messages via REST', async () => {
            // 1. Resolve conversation
            const convRes = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/conversations/direct')
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ targetUserId: bobId });
            const convId = convRes.body.data.id;
            // 2. Send message via REST
            const sendRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/conversations/${convId}/messages`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ text: 'Hello Bob!' });
            (0, vitest_1.expect)(sendRes.status).toBe(201);
            (0, vitest_1.expect)(sendRes.body.data.text).toBe('Hello Bob!');
            const messageId = sendRes.body.data.id;
            // 3. Edit message
            const editRes = await (0, supertest_1.default)(app_1.default)
                .put(`/api/v1/conversations/messages/${messageId}`)
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ text: 'Hello Bob! (edited)' });
            (0, vitest_1.expect)(editRes.status).toBe(200);
            (0, vitest_1.expect)(editRes.body.data.text).toBe('Hello Bob! (edited)');
            // 4. Toggle Emoji reaction
            const reactRes = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/conversations/messages/${messageId}/react`)
                .set('Authorization', `Bearer ${bobToken}`)
                .send({ emoji: 'thumbs_up' });
            (0, vitest_1.expect)(reactRes.status).toBe(200);
            (0, vitest_1.expect)(reactRes.body.data.reactions['thumbs_up']).toContain(bobId);
            // 5. Delete message
            const deleteRes = await (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/conversations/messages/${messageId}`)
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(deleteRes.status).toBe(200);
            (0, vitest_1.expect)(deleteRes.body.data.text).toBe('This message was deleted.');
        });
        (0, vitest_1.it)('Should handle unread counters and marking conversations as read', async () => {
            // 1. Resolve conversation
            const convRes = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/conversations/direct')
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ targetUserId: bobId });
            const convId = convRes.body.data.id;
            // 2. Bob sends two messages
            await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/conversations/${convId}/messages`)
                .set('Authorization', `Bearer ${bobToken}`)
                .send({ text: 'Message 1' });
            await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/conversations/${convId}/messages`)
                .set('Authorization', `Bearer ${bobToken}`)
                .send({ text: 'Message 2' });
            // 3. Alice gets her unread counts
            const countRes = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/conversations/unread-count')
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(countRes.status).toBe(200);
            (0, vitest_1.expect)(countRes.body.data.unreadCount).toBe(2);
            // 4. Alice marks the conversation as read
            await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/conversations/${convId}/read`)
                .set('Authorization', `Bearer ${aliceToken}`);
            // 5. Unread count becomes 0
            const countRes2 = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/conversations/unread-count')
                .set('Authorization', `Bearer ${aliceToken}`);
            (0, vitest_1.expect)(countRes2.body.data.unreadCount).toBe(0);
        });
    });
    (0, vitest_1.describe)('Socket.IO Real-Time Engine', () => {
        (0, vitest_1.it)('Should allow connection with a valid token, tracking presence status in Redis', async () => {
            const client = createSocketClient(aliceToken);
            await new Promise((resolve, reject) => {
                client.on('connect', resolve);
                client.on('connect_error', reject);
            });
            (0, vitest_1.expect)(client.connected).toBe(true);
            // Wait a brief moment for the server-side async connection event handler to write to Redis
            await new Promise((resolve) => setTimeout(resolve, 50));
            // Verify status is online in Redis
            const redis = redis_1.redisManager.getClient();
            const status = await redis.get(`presence:status:${aliceId}`);
            (0, vitest_1.expect)(status).toBe('online');
            // Disconnect
            client.disconnect();
            // Wait a brief moment for status update
            await new Promise((resolve) => setTimeout(resolve, 100));
            const statusOffline = await redis.get(`presence:status:${aliceId}`);
            (0, vitest_1.expect)(statusOffline).toBeNull();
        });
        (0, vitest_1.it)('Should prevent connection with an invalid token', async () => {
            const client = createSocketClient('InvalidTokenHere');
            const errorOccurred = await new Promise((resolve) => {
                client.on('connect_error', () => resolve(true));
            });
            (0, vitest_1.expect)(errorOccurred).toBe(true);
            (0, vitest_1.expect)(client.connected).toBe(false);
        });
        (0, vitest_1.it)('Should restrict room join based on conversation/trip membership', async () => {
            // 1. Create a trip with Alice as organizer
            const tripRes = await (0, supertest_1.default)(app_1.default)
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
            await new Promise((resolve) => {
                bobClient.on('connect', resolve);
            });
            const joinRes = await new Promise((resolve) => {
                bobClient.emit('join_room', { roomId: tripId }, resolve);
            });
            (0, vitest_1.expect)(joinRes.success).toBe(false);
            (0, vitest_1.expect)(joinRes.error).toContain('You must be a member of the trip');
        });
        (0, vitest_1.it)('Should broadcast send_message to all room members', async () => {
            // 1. Alice creates direct conversation with Bob
            const convRes = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/conversations/direct')
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ targetUserId: bobId });
            const convId = convRes.body.data.id;
            // 2. Connect Alice and Bob to Socket server and join the room
            const aliceClient = createSocketClient(aliceToken);
            const bobClient = createSocketClient(bobToken);
            await Promise.all([
                new Promise((resolve) => aliceClient.on('connect', resolve)),
                new Promise((resolve) => bobClient.on('connect', resolve)),
            ]);
            await Promise.all([
                new Promise((resolve) => aliceClient.emit('join_room', { roomId: convId }, () => resolve())),
                new Promise((resolve) => bobClient.emit('join_room', { roomId: convId }, () => resolve())),
            ]);
            // 3. Bob sends a message, Alice expects to receive new_message event
            const msgPromise = new Promise((resolve) => {
                aliceClient.on('new_message', resolve);
            });
            bobClient.emit('send_message', {
                chatId: convId,
                text: 'Socket communication is live!',
            });
            const receivedMsg = await msgPromise;
            (0, vitest_1.expect)(receivedMsg.text).toBe('Socket communication is live!');
            (0, vitest_1.expect)(receivedMsg.senderId).toBe(bobId);
        });
        (0, vitest_1.it)('Should broadcast typing indicators', async () => {
            const convRes = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/conversations/direct')
                .set('Authorization', `Bearer ${aliceToken}`)
                .send({ targetUserId: bobId });
            const convId = convRes.body.data.id;
            const aliceClient = createSocketClient(aliceToken);
            const bobClient = createSocketClient(bobToken);
            await Promise.all([
                new Promise((resolve) => aliceClient.on('connect', resolve)),
                new Promise((resolve) => bobClient.on('connect', resolve)),
            ]);
            await Promise.all([
                new Promise((resolve) => aliceClient.emit('join_room', { roomId: convId }, () => resolve())),
                new Promise((resolve) => bobClient.emit('join_room', { roomId: convId }, () => resolve())),
            ]);
            const typingPromise = new Promise((resolve) => {
                bobClient.on('user_typing', resolve);
            });
            aliceClient.emit('typing', {
                roomId: convId,
                isTyping: true,
            });
            const typingEvent = await typingPromise;
            (0, vitest_1.expect)(typingEvent.roomId).toBe(convId);
            (0, vitest_1.expect)(typingEvent.userId).toBe(aliceId);
            (0, vitest_1.expect)(typingEvent.isTyping).toBe(true);
        });
    });
});
