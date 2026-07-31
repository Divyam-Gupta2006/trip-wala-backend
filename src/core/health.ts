import { Router, Request, Response } from 'express';
import { prisma } from './db';
import { redisManager } from './redis';
import { logger } from './logger';
import { backgroundQueue } from './jobs/queue';
import { getIoServer } from '../features/messaging/socket.handler';

export const healthRouter = Router();

const APP_VERSION = '1.0.0';

// GET /health/live -> Process is running
healthRouter.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Process is alive',
    data: {
      status: 'up',
      uptime: process.uptime(),
      version: APP_VERSION,
    },
  });
});

// GET /health/ready -> Database, Redis, and Queue connections are healthy
healthRouter.get('/ready', async (_req: Request, res: Response) => {
  let dbHealthy = false;
  let redisHealthy = false;
  let queueHealthy = false;

  try {
    // Check PostgreSQL
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch (err) {
    logger.error('💥 Database Health Check Failed:', err);
  }

  try {
    // Check Redis
    const redisClient = redisManager.getClient();
    const pong = await redisClient.ping();
    if (pong === 'PONG') {
      redisHealthy = true;
    }
  } catch (err) {
    logger.error('💥 Redis Health Check Failed:', err);
  }

  try {
    // Check BullMQ Queue Client Connection
    const client = await backgroundQueue.client;
    if (client.status === 'ready' || client.status === 'connecting') {
      queueHealthy = true;
    }
  } catch (err) {
    logger.error('💥 BullMQ Health Check Failed:', err);
  }

  const allHealthy = dbHealthy && redisHealthy && queueHealthy;

  if (allHealthy) {
    res.status(200).json({
      success: true,
      message: 'Services are ready',
      data: {
        database: 'connected',
        redis: 'connected',
        queue: 'connected',
        version: APP_VERSION,
      },
    });
  } else {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICES_UNAVAILABLE',
        message: 'One or more backing services failed to respond',
      },
      data: {
        database: dbHealthy ? 'connected' : 'failed',
        redis: redisHealthy ? 'connected' : 'failed',
        queue: queueHealthy ? 'connected' : 'failed',
        version: APP_VERSION,
      },
    });
  }
});

// GET /health -> Overall application status with diagnostics
healthRouter.get('/', async (_req: Request, res: Response) => {
  let dbHealthy = false;
  let redisHealthy = false;
  let queueHealthy = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch (err) {
    logger.warn('Database health check failed');
  }

  try {
    const pong = await redisManager.getClient().ping();
    if (pong === 'PONG') redisHealthy = true;
  } catch (err) {
    logger.warn('Redis health check failed');
  }

  try {
    const client = await backgroundQueue.client;
    if (client.status === 'ready' || client.status === 'connecting') {
      queueHealthy = true;
    }
  } catch (err) {
    logger.warn('Queue health check failed');
  }

  // Socket Server diagnostics
  const io = getIoServer();
  const socketActive = !!io;
  const socketClients = io ? io.sockets.sockets.size : 0;

  const overallHealthy = dbHealthy && redisHealthy && queueHealthy;

  res.status(overallHealthy ? 200 : 503).json({
    success: overallHealthy,
    message: 'Application health status retrieved',
    data: {
      status: overallHealthy ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      services: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        redis: redisHealthy ? 'healthy' : 'unhealthy',
        queue: queueHealthy ? 'healthy' : 'unhealthy',
        socket: {
          status: socketActive ? 'active' : 'offline',
          connections: socketClients,
        },
      },
    },
  });
});
