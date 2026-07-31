"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backgroundQueue = void 0;
exports.enqueueJob = enqueueJob;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("../config");
const logger_1 = require("../logger");
// Dedicated connection for the Queue to avoid blocking/concurrency issues
const connection = new ioredis_1.default(config_1.config.REDIS_URL, {
    maxRetriesPerRequest: null,
});
connection.on('error', (err) => {
    logger_1.logger.error('❌ BullMQ Redis Connection Error:', err);
});
exports.backgroundQueue = new bullmq_1.Queue('trip-wala-jobs', {
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
async function enqueueJob(type, payload, options = {}) {
    try {
        const job = await exports.backgroundQueue.add(type, payload, {
            delay: options.delay,
            priority: options.priority,
        });
        logger_1.logger.info(`📥 Enqueued job: ${type} (Job ID: ${job.id})`);
        return job;
    }
    catch (err) {
        logger_1.logger.error(`❌ Failed to enqueue job ${type}:`, err);
        throw err;
    }
}
