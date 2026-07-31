import Redis from 'ioredis';
import { config } from './config';
import { logger } from './logger';

class RedisManager {
  private client: Redis | null = null;

  connect(): Redis {
    if (this.client) return this.client;

    this.client = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    this.client.on('connect', () => {
      logger.info('🔌 Connecting to Redis...');
    });

    this.client.on('ready', () => {
      logger.info('✅ Redis is ready');
    });

    this.client.on('error', (err) => {
      logger.error('❌ Redis Connection Error:', err);
    });

    this.client.on('end', () => {
      logger.warn('🔌 Redis connection ended');
    });

    return this.client;
  }

  getClient(): Redis {
    if (!this.client) {
      return this.connect();
    }
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('🔌 Redis disconnected cleanly');
    }
  }
}

export const redisManager = new RedisManager();
