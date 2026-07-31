import { Server, Socket } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../../core/config';
import { logger } from '../../core/logger';
import { prisma } from '../../core/db';
import { redisManager } from '../../core/redis';
import { MessagingService } from './messaging.service';

const service = new MessagingService();

interface SocketData {
  userId: string;
  userName: string;
}

let ioInstance: Server | null = null;

export function getIoServer(): Server | null {
  return ioInstance;
}

export function initSocketServer(server: http.Server): Server {
  const io = new Server(server, {
    cors: {
      origin: config.CORS_ORIGIN === '*' ? '*' : config.CORS_ORIGIN.split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io', // standard handshake path
  });

  ioInstance = io;

  // Authentication Middleware
  io.use(async (socket: Socket<any, any, any, SocketData>, next) => {
    try {
      let token = socket.handshake.auth?.token || socket.handshake.query?.token;

      if (typeof token === 'string' && token.startsWith('Bearer ')) {
        token = token.split(' ')[1];
      }

      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      const decoded = jwt.verify(token, config.JWT_SECRET) as {
        userId: string;
        name: string;
        sessionId: string;
      };

      // Verify session exists in PostgreSQL
      const session = await prisma.session.findUnique({
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
    } catch (err) {
      logger.error('Socket authentication failed:', err);
      next(new Error('Invalid or expired authentication token'));
    }
  });

  io.on('connection', (socket: Socket<any, any, any, SocketData>) => {
    const userId = socket.data.userId;
    const userName = socket.data.userName;
    const redis = redisManager.getClient();
    const presenceKey = `presence:user:${userId}`;

    logger.info(`🔌 User connected to Socket.IO: ${userName} (${userId}) [Socket: ${socket.id}]`);

    // Join personal user room for targeted notifications
    socket.join(`user:${userId}`);

    // --- 1. Join Room ---
    socket.on('join_room', async (payload: { roomId: string }, callback?: (response: any) => void) => {
      try {
        const { roomId } = payload;
        if (!roomId) {
          if (callback) callback({ success: false, error: 'roomId is required' });
          return;
        }

        // Verify user has access to conversation
        await service.verifyAccess(roomId, userId);

        socket.join(roomId);
        logger.info(`👤 Socket ${socket.id} joined room: ${roomId}`);
        if (callback) callback({ success: true });
      } catch (err: any) {
        logger.error(`Failed to join room: ${err.message}`);
        socket.emit('chat_error', { message: err.message || 'Failed to join room' });
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // --- 2. Leave Room ---
    socket.on('leave_room', (payload: { roomId: string }, callback?: (response: any) => void) => {
      const { roomId } = payload;
      if (roomId) {
        socket.leave(roomId);
        logger.info(`👤 Socket ${socket.id} left room: ${roomId}`);
        if (callback) callback({ success: true });
      } else {
        if (callback) callback({ success: false, error: 'roomId is required' });
      }
    });

    // --- 3. Send Message ---
    socket.on(
      'send_message',
      async (
        payload: {
          chatId: string;
          text: string;
          imageUrl?: string;
          filePath?: string;
          replyToMessageId?: string;
          replyToMessageText?: string;
          replyToMessageSender?: string;
          mentions?: string[];
        },
        callback?: (response: any) => void
      ) => {
        try {
          const { chatId, text } = payload;
          if (!chatId || !text) {
            if (callback) callback({ success: false, error: 'chatId and text are required' });
            return;
          }

          // Save message using service layer
          const savedMsg = await service.sendMessage(chatId, userId, payload);

          // Broadcast to all sockets in the conversation room
          io.to(chatId).emit('new_message', savedMsg);

          if (callback) callback({ success: true, data: savedMsg });
        } catch (err: any) {
          logger.error(`Failed to send socket message: ${err.message}`);
          socket.emit('chat_error', { message: err.message || 'Failed to send message' });
          if (callback) callback({ success: false, error: err.message });
        }
      }
    );

    // --- 4. Typing Indicators ---
    socket.on('typing', (payload: { roomId: string; isTyping: boolean }) => {
      const { roomId, isTyping } = payload;
      if (!roomId) return;

      // Broadcast to other members in the room
      socket.to(roomId).emit('user_typing', {
        roomId,
        userId,
        isTyping,
      });
    });

    // --- 5. Disconnect ---
    socket.on('disconnect', async () => {
      logger.info(`🔌 User disconnected from Socket.IO: ${userName} (${userId}) [Socket: ${socket.id}]`);

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
          logger.debug(`User ${userName} (${userId}) is now offline`);
        }
      } catch (err) {
        logger.error(`Error updating offline status for user ${userId}:`, err);
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
          logger.debug(`User ${userName} (${userId}) is now online`);
        }
      } catch (err) {
        logger.error(`Error updating online status for user ${userId}:`, err);
      }
    })();
  });

  return io;
}
