"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisManager = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("./config");
const logger_1 = require("./logger");
class RedisManager {
    client = null;
    connect() {
        if (this.client)
            return this.client;
        this.client = new ioredis_1.default(config_1.config.REDIS_URL, {
            maxRetriesPerRequest: null,
            enableReadyCheck: true,
        });
        this.client.on('connect', () => {
            logger_1.logger.info('🔌 Connecting to Redis...');
        });
        this.client.on('ready', () => {
            logger_1.logger.info('✅ Redis is ready');
        });
        this.client.on('error', (err) => {
            logger_1.logger.error('❌ Redis Connection Error:', err);
        });
        this.client.on('end', () => {
            logger_1.logger.warn('🔌 Redis connection ended');
        });
        return this.client;
    }
    getClient() {
        if (!this.client) {
            return this.connect();
        }
        return this.client;
    }
    async disconnect() {
        if (this.client) {
            await this.client.quit();
            this.client = null;
            logger_1.logger.info('🔌 Redis disconnected cleanly');
        }
    }
}
exports.redisManager = new RedisManager();
