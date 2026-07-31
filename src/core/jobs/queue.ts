import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../logger';
import { JobType, JobPayloadMap } from './types';

// Dedicated connection for the Queue to avoid blocking/concurrency issues
const connection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

connection.on('error', (err) => {
  logger.error('❌ BullMQ Redis Connection Error:', err);
});

export const backgroundQueue = new Queue('trip-wala-jobs', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // keep for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // keep for 7 days
    },
  },
});

export async function enqueueJob<T extends JobType>(
  type: T,
  payload: JobPayloadMap[T],
  options: { delay?: number; priority?: number } = {}
) {
  try {
    const job = await backgroundQueue.add(type, payload, {
      delay: options.delay,
      priority: options.priority,
    });
    logger.info(`📥 Enqueued job: ${type} (Job ID: ${job.id})`);
    return job;
  } catch (err) {
    logger.error(`❌ Failed to enqueue job ${type}:`, err);
    throw err;
  }
}
