import app from './app';
import { config } from './core/config';
import { logger } from './core/logger';
import { prisma } from './core/db';
import { redisManager } from './core/redis';
import { initSocketServer } from './features/messaging/socket.handler';
import { backgroundWorker } from './core/jobs/worker';
import { enqueueJob } from './core/jobs/queue';

async function bootstrap() {
  try {
    logger.info('🚀 Starting Trip Wala Backend API...');

    // 1. Validate Database Connection
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

    // 2. Validate Redis Connection
    redisManager.connect();

    // 3. Listen on port
    const server = app.listen(config.PORT, () => {
      logger.info(`🚀 Server running in [${config.NODE_ENV}] mode on http://localhost:${config.PORT}`);
      logger.info(`📚 Swagger docs available on http://localhost:${config.PORT}/docs`);
    });

    // Initialize Socket.IO Server
    initSocketServer(server);
    logger.info('🔌 Socket.IO Server initialized successfully');

    // Start background worker
    logger.info('⚙️ Background worker started and listening for jobs');

    // Queue initial database cleanup job
    if (config.NODE_ENV !== 'test') {
      enqueueJob('cleanup', { olderThanDays: 30 }, { delay: 5000 })
        .then(() => logger.info('⚙️ Enqueued initial DB cleanup background job'))
        .catch((err) => logger.error('❌ Failed to enqueue initial cleanup job:', err));
    }

    // 4. Graceful Shutdown Handler
    const shutdown = async (signal: string) => {
      logger.warn(`📥 Received ${signal}. Initiating graceful shutdown...`);

      // Stop worker first to stop accepting new jobs
      try {
        await backgroundWorker.close();
        logger.info('⚙️ Background worker stopped');
      } catch (workerErr) {
        logger.error('❌ Error shutting down background worker:', workerErr);
      }

      server.close(async () => {
        logger.info('🛑 HTTP server closed');

        // Disconnect Prisma
        await prisma.$disconnect();
        logger.info('🔌 Database disconnected');

        // Disconnect Redis
        await redisManager.disconnect();

        logger.info('👋 Graceful shutdown complete. Exiting.');
        process.exit(0);
      });

      // Force shutdown after 10s timeout
      setTimeout(() => {
        logger.error('💥 Forced shutdown: operations took too long to close');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    logger.error('💥 Bootstrap Failed:', err);
    process.exit(1);
  }
}

bootstrap();
