"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIoServer = getIoServer;
exports.initSocketServer = initSocketServer;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../../core/config");
const logger_1 = require("../../core/logger");
const db_1 = require("../../core/db");
const redis_1 = require("../../core/redis");
const messaging_service_1 = require("./messaging.service");
const service = new messaging_service_1.MessagingService();
let ioInstance = null;
function getIoServer() {
    return ioInstance;
}
function initSocketServer(server) {
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: config_1.config.CORS_ORIGIN === '*' ? '*' : config_1.config.CORS_ORIGIN.split(','),
            methods: ['GET', 'POST'],
            credentials: true,
        },
        path: '/socket.io', // standard handshake path
    });
    ioInstance = io;
    // Authentication Middleware
    io.use(async (socket, next) => {
        try {
            let token = socket.handshake.auth?.token || socket.handshake.query?.token;
            if (typeof token === 'string' && token.startsWith('Bearer ')) {
                token = token.split(' ')[1];
            }
            if (!token) {
                return next(new Error('Authentication token missing'));
            }
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET);
            // Verify session exists in PostgreSQL
            const session = await db_1.prisma.session.findUnique({
                where: { id: decoded.sessionId },
                include: { user: true },
            });
            if (!session || session.user.isDeleted) {
                return next(new Error('Session expired or user deleted'));
            }
            // Attach user information to socket data
            socket.data.userId = decoded.userId;
            socket.data.userName = decoded.name;
            next();
        }
        catch (err) {
            logger_1.logger.error('Socket authentication failed:', err);
            next(new Error('Invalid or expired authentication token'));
        }
    });
    io.on('connection', (socket) => {
        const userId = socket.data.userId;
        const userName = socket.data.userName;
        const redis = redis_1.redisManager.getClient();
        const presenceKey = `presence:user:${userId}`;
        logger_1.logger.info(`🔌 User connected to Socket.IO: ${userName} (${userId}) [Socket: ${socket.id}]`);
        // Join personal user room for targeted notifications
        socket.join(`user:${userId}`);
        // --- 1. Join Room ---
        socket.on('join_room', async (payload, callback) => {
            try {
                const { roomId } = payload;
                if (!roomId) {
                    if (callback)
                        callback({ success: false, error: 'roomId is required' });
                    return;
                }
                // Verify user has access to conversation
                await service.verifyAccess(roomId, userId);
                socket.join(roomId);
                logger_1.logger.info(`👤 Socket ${socket.id} joined room: ${roomId}`);
                if (callback)
                    callback({ success: true });
            }
            catch (err) {
                logger_1.logger.error(`Failed to join room: ${err.message}`);
                socket.emit('chat_error', { message: err.message || 'Failed to join room' });
                if (callback)
                    callback({ success: false, error: err.message });
            }
        });
        // --- 2. Leave Room ---
        socket.on('leave_room', (payload, callback) => {
            const { roomId } = payload;
            if (roomId) {
                socket.leave(roomId);
                logger_1.logger.info(`👤 Socket ${socket.id} left room: ${roomId}`);
                if (callback)
                    callback({ success: true });
            }
            else {
                if (callback)
                    callback({ success: false, error: 'roomId is required' });
            }
        });
        // --- 3. Send Message ---
        socket.on('send_message', async (payload, callback) => {
            try {
                const { chatId, text } = payload;
                if (!chatId || !text) {
                    if (callback)
                        callback({ success: false, error: 'chatId and text are required' });
                    return;
                }
                // Save message using service layer
                const savedMsg = await service.sendMessage(chatId, userId, payload);
                // Broadcast to all sockets in the conversation room
                io.to(chatId).emit('new_message', savedMsg);
                if (callback)
                    callback({ success: true, data: savedMsg });
            }
            catch (err) {
                logger_1.logger.error(`Failed to send socket message: ${err.message}`);
                socket.emit('chat_error', { message: err.message || 'Failed to send message' });
                if (callback)
                    callback({ success: false, error: err.message });
            }
        });
        // --- 4. Typing Indicators ---
        socket.on('typing', (payload) => {
            const { roomId, isTyping } = payload;
            if (!roomId)
                return;
            // Broadcast to other members in the room
            socket.to(roomId).emit('user_typing', {
                roomId,
                userId,
                isTyping,
            });
        });
        // --- 5. Disconnect ---
        socket.on('disconnect', async () => {
            logger_1.logger.info(`🔌 User disconnected from Socket.IO: ${userName} (${userId}) [Socket: ${socket.id}]`);
            try {
                // Remove socket ID from Redis presence set
                await redis.srem(presenceKey, socket.id);
                const remainingSockets = await redis.scard(presenceKey);
                // If no active connections left, mark user offline and broadcast presence
                if (remainingSockets === 0) {
                    await redis.del(presenceKey);
                    await redis.del(`presence:status:${userId}`);
                    io.emit('member_presence', {
                        userId,
                        status: 'offline',
                    });
                    logger_1.logger.debug(`User ${userName} (${userId}) is now offline`);
                }
            }
            catch (err) {
                logger_1.logger.error(`Error updating offline status for user ${userId}:`, err);
            }
        });
        // Run async presence logic independently after registering synchronous listeners
        (async () => {
            try {
                // Add socket ID to user presence set in Redis
                await redis.sadd(presenceKey, socket.id);
                const activeSocketsCount = await redis.scard(presenceKey);
                // If this is the user's first connection, mark online and broadcast presence
                if (activeSocketsCount === 1) {
                    await redis.set(`presence:status:${userId}`, 'online');
                    io.emit('member_presence', {
                        userId,
                        status: 'online',
                    });
                    logger_1.logger.debug(`User ${userName} (${userId}) is now online`);
                }
            }
            catch (err) {
                logger_1.logger.error(`Error updating online status for user ${userId}:`, err);
            }
        })();
    });
    return io;
}
