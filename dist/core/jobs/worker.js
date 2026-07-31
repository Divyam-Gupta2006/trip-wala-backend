"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backgroundWorker = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const db_1 = require("../db");
const config_1 = require("../config");
const logger_1 = require("../logger");
const trust_service_1 = require("../../features/trust/trust.service");
// Dedicated ioredis connection for the Worker to run blocking commands
const connection = new ioredis_1.default(config_1.config.REDIS_URL, {
    maxRetriesPerRequest: null,
});
connection.on('error', (err) => {
    logger_1.logger.error('❌ BullMQ Worker Redis Connection Error:', err);
});
exports.backgroundWorker = new bullmq_1.Worker('trip-wala-jobs', async (job) => {
    const jobType = job.name;
    logger_1.logger.info(`⚙️ Processing background job: ${jobType} (Job ID: ${job.id})`);
    switch (jobType) {
        case 'notification-fanout':
            await handleNotificationFanout(job.data);
            break;
        case 'email-delivery':
            await handleEmailDelivery(job.data);
            break;
        case 'cleanup':
            await handleCleanup(job.data);
            break;
        case 'trust-score-recalculate':
            await handleTrustScoreRecalculate(job.data);
            break;
        case 'maintenance':
            await handleMaintenance(job.data);
            break;
        default:
            logger_1.logger.warn(`⚠️ Unhandled job type: ${jobType}`);
    }
}, {
    connection,
    concurrency: 5, // process up to 5 jobs concurrently
});
exports.backgroundWorker.on('completed', (job) => {
    logger_1.logger.info(`✅ Job ${job.name} (Job ID: ${job.id}) completed successfully`);
});
exports.backgroundWorker.on('failed', (job, err) => {
    logger_1.logger.error(`❌ Job ${job?.name} (Job ID: ${job?.id}) failed: ${err.message}`, err);
});
// ─── Handler Functions ────────────────────────────────────────────────────────
async function handleNotificationFanout(data) {
    logger_1.logger.info(`📣 Fan-out notification ${data.notificationId} to ${data.userIds.length} users`);
    // In a real system, we'd query the notification and duplicate it or push it via FCM/APNS for each user.
    // Currently, standard notification flows publish to single users. This queue is prepared to scale.
}
async function handleEmailDelivery(data) {
    logger_1.logger.info(`📧 Sending email to ${data.to}: Subject: "${data.subject}"`);
    // Mock sending email
    // e.g. nodemailer transport sendMail
}
async function handleCleanup(data) {
    logger_1.logger.info(`🧹 Running database cleanup: deleting records older than ${data.olderThanDays} days`);
    const cutoffDate = new Date(Date.now() - data.olderThanDays * 24 * 3600 * 1000);
    try {
        // 1. Purge expired refresh tokens
        const deletedTokens = await db_1.prisma.refreshToken.deleteMany({
            where: {
                createdAt: { lt: cutoffDate },
            },
        });
        logger_1.logger.info(`🧹 Cleaned up ${deletedTokens.count} expired refresh tokens`);
        // 2. Purge soft-deleted trips that are old
        const deletedTrips = await db_1.prisma.trip.deleteMany({
            where: {
                isDeleted: true,
                deletedAt: { lt: cutoffDate },
            },
        });
        logger_1.logger.info(`🧹 Purged ${deletedTrips.count} soft-deleted trips older than cutoff`);
    }
    catch (err) {
        logger_1.logger.error(`❌ DB cleanup failed: ${err.message}`);
        throw err;
    }
}
async function handleTrustScoreRecalculate(data) {
    logger_1.logger.info(`🛡️ Recalculating trust score for user ${data.userId}`);
    const score = await trust_service_1.trustService.calculateAndSyncTrustScore(data.userId);
    logger_1.logger.info(`🛡️ Recalculation complete. New score for user ${data.userId} is ${score}`);
}
async function handleMaintenance(data) {
    logger_1.logger.info(`🔧 Running scheduled maintenance: ${data.task}`);
    if (data.task === 'session-cleanup') {
        const expiredCutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000); // 30 days ago
        const deletedSessions = await db_1.prisma.session.deleteMany({
            where: {
                lastActiveAt: { lt: expiredCutoff },
            },
        });
        logger_1.logger.info(`🔧 Purged ${deletedSessions.count} inactive sessions`);
    }
}
