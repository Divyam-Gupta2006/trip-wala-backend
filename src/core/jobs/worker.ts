import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '../db';
import { config } from '../config';
import { logger } from '../logger';
import { trustService } from '../../features/trust/trust.service';
import {
  JobType,
  NotificationFanoutPayload,
  EmailDeliveryPayload,
  CleanupPayload,
  TrustScoreRecalculatePayload,
  MaintenancePayload,
} from './types';

// Dedicated ioredis connection for the Worker to run blocking commands
const connection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

connection.on('error', (err) => {
  logger.error('❌ BullMQ Worker Redis Connection Error:', err);
});

export const backgroundWorker = new Worker(
  'trip-wala-jobs',
  async (job: Job) => {
    const jobType = job.name as JobType;
    logger.info(`⚙️ Processing background job: ${jobType} (Job ID: ${job.id})`);

    switch (jobType) {
      case 'notification-fanout':
        await handleNotificationFanout(job.data as NotificationFanoutPayload);
        break;

      case 'email-delivery':
        await handleEmailDelivery(job.data as EmailDeliveryPayload);
        break;

      case 'cleanup':
        await handleCleanup(job.data as CleanupPayload);
        break;

      case 'trust-score-recalculate':
        await handleTrustScoreRecalculate(job.data as TrustScoreRecalculatePayload);
        break;

      case 'maintenance':
        await handleMaintenance(job.data as MaintenancePayload);
        break;

      default:
        logger.warn(`⚠️ Unhandled job type: ${jobType}`);
    }
  },
  {
    connection,
    concurrency: 5, // process up to 5 jobs concurrently
  }
);

backgroundWorker.on('completed', (job) => {
  logger.info(`✅ Job ${job.name} (Job ID: ${job.id}) completed successfully`);
});

backgroundWorker.on('failed', (job, err) => {
  logger.error(`❌ Job ${job?.name} (Job ID: ${job?.id}) failed: ${err.message}`, err);
});

// ─── Handler Functions ────────────────────────────────────────────────────────

async function handleNotificationFanout(data: NotificationFanoutPayload) {
  logger.info(`📣 Fan-out notification ${data.notificationId} to ${data.userIds.length} users`);
  // In a real system, we'd query the notification and duplicate it or push it via FCM/APNS for each user.
  // Currently, standard notification flows publish to single users. This queue is prepared to scale.
}

async function handleEmailDelivery(data: EmailDeliveryPayload) {
  logger.info(`📧 Sending email to ${data.to}: Subject: "${data.subject}"`);
  // Mock sending email
  // e.g. nodemailer transport sendMail
}

async function handleCleanup(data: CleanupPayload) {
  logger.info(`🧹 Running database cleanup: deleting records older than ${data.olderThanDays} days`);
  const cutoffDate = new Date(Date.now() - data.olderThanDays * 24 * 3600 * 1000);

  try {
    // 1. Purge expired refresh tokens
    const deletedTokens = await prisma.refreshToken.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });
    logger.info(`🧹 Cleaned up ${deletedTokens.count} expired refresh tokens`);

    // 2. Purge soft-deleted trips that are old
    const deletedTrips = await prisma.trip.deleteMany({
      where: {
        isDeleted: true,
        deletedAt: { lt: cutoffDate },
      },
    });
    logger.info(`🧹 Purged ${deletedTrips.count} soft-deleted trips older than cutoff`);
  } catch (err: any) {
    logger.error(`❌ DB cleanup failed: ${err.message}`);
    throw err;
  }
}

async function handleTrustScoreRecalculate(data: TrustScoreRecalculatePayload) {
  logger.info(`🛡️ Recalculating trust score for user ${data.userId}`);
  const score = await trustService.calculateAndSyncTrustScore(data.userId);
  logger.info(`🛡️ Recalculation complete. New score for user ${data.userId} is ${score}`);
}

async function handleMaintenance(data: MaintenancePayload) {
  logger.info(`🔧 Running scheduled maintenance: ${data.task}`);
  if (data.task === 'session-cleanup') {
    const expiredCutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000); // 30 days ago
    const deletedSessions = await prisma.session.deleteMany({
      where: {
        lastActiveAt: { lt: expiredCutoff },
      },
    });
    logger.info(`🔧 Purged ${deletedSessions.count} inactive sessions`);
  }
}
