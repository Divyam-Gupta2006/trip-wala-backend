"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = require("./core/config");
const logger_1 = require("./core/logger");
const db_1 = require("./core/db");
const redis_1 = require("./core/redis");
const socket_handler_1 = require("./features/messaging/socket.handler");
const worker_1 = require("./core/jobs/worker");
const queue_1 = require("./core/jobs/queue");
async function bootstrap() {
    try {
        logger_1.logger.info('🚀 Starting Trip Wala Backend API...');
        // 1. Validate Database Connection
        await db_1.prisma.$connect();
        logger_1.logger.info('✅ Database connected successfully');
        // 2. Validate Redis Connection
        redis_1.redisManager.connect();
        // 3. Listen on port
        const server = app_1.default.listen(config_1.config.PORT, () => {
            logger_1.logger.info(`🚀 Server running in [${config_1.config.NODE_ENV}] mode on http://localhost:${config_1.config.PORT}`);
            logger_1.logger.info(`📚 Swagger docs available on http://localhost:${config_1.config.PORT}/docs`);
        });
        // Initialize Socket.IO Server
        (0, socket_handler_1.initSocketServer)(server);
        logger_1.logger.info('🔌 Socket.IO Server initialized successfully');
        // Start background worker
        logger_1.logger.info('⚙️ Background worker started and listening for jobs');
        // Queue initial database cleanup job
        if (config_1.config.NODE_ENV !== 'test') {
            (0, queue_1.enqueueJob)('cleanup', { olderThanDays: 30 }, { delay: 5000 })
                .then(() => logger_1.logger.info('⚙️ Enqueued initial DB cleanup background job'))
                .catch((err) => logger_1.logger.error('❌ Failed to enqueue initial cleanup job:', err));
        }
        // 4. Graceful Shutdown Handler
        const shutdown = async (signal) => {
            logger_1.logger.warn(`📥 Received ${signal}. Initiating graceful shutdown...`);
            // Stop worker first to stop accepting new jobs
            try {
                await worker_1.backgroundWorker.close();
                logger_1.logger.info('⚙️ Background worker stopped');
            }
            catch (workerErr) {
                logger_1.logger.error('❌ Error shutting down background worker:', workerErr);
            }
            server.close(async () => {
                logger_1.logger.info('🛑 HTTP server closed');
                // Disconnect Prisma
                await db_1.prisma.$disconnect();
                logger_1.logger.info('🔌 Database disconnected');
                // Disconnect Redis
                await redis_1.redisManager.disconnect();
                logger_1.logger.info('👋 Graceful shutdown complete. Exiting.');
                process.exit(0);
            });
            // Force shutdown after 10s timeout
            setTimeout(() => {
                logger_1.logger.error('💥 Forced shutdown: operations took too long to close');
                process.exit(1);
            }, 10000);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
    catch (err) {
        logger_1.logger.error('💥 Bootstrap Failed:', err);
        process.exit(1);
    }
}
bootstrap();
