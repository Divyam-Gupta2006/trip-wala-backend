import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import { buildApp } from './app';
import { logger } from './shared/logger';
import { prisma } from './shared/database/prisma';

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    // 1. Connect to Database
    await prisma.$connect();
    logger.info('Connected to PostgreSQL database via Prisma');

    // 2. Build Express App
    const app = buildApp();
    const server = http.createServer(app);

    // 3. Initialize Socket.IO
    const io = new Server(server, {
      cors: {
        origin: '*', // Restrict in production
        methods: ['GET', 'POST'],
      },
      transports: ['websocket'],
    });

    io.on('connection', (socket) => {
      logger.info(`Socket connected: ${socket.id}`);
      
      socket.on('join_room', (data) => {
        if (data.room) {
          socket.join(data.room);
          logger.info(`Socket ${socket.id} joined room ${data.room}`);
        }
      });
      
      socket.on('leave_room', (data) => {
        if (data.room) {
          socket.leave(data.room);
          logger.info(`Socket ${socket.id} left room ${data.room}`);
        }
      });

      socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`);
      });
    });

    // Make Socket.IO available to Express routes
    app.set('io', io);

    // 4. Start Server
    server.listen(PORT, () => {
      logger.info(`Trip Wala Backend running on http://localhost:${PORT}`);
    });

    // 5. Graceful Shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');
      server.close(() => {
        logger.info('HTTP server closed');
      });
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

bootstrap();
