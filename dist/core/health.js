"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
const db_1 = require("./db");
const redis_1 = require("./redis");
const logger_1 = require("./logger");
const queue_1 = require("./jobs/queue");
const socket_handler_1 = require("../features/messaging/socket.handler");
exports.healthRouter = (0, express_1.Router)();
const APP_VERSION = '1.0.0';
// GET /health/live -> Process is running
exports.healthRouter.get('/live', (_req, res) => {
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
exports.healthRouter.get('/ready', async (_req, res) => {
    let dbHealthy = false;
    let redisHealthy = false;
    let queueHealthy = false;
    try {
        // Check PostgreSQL
        await db_1.prisma.$queryRaw `SELECT 1`;
        dbHealthy = true;
    }
    catch (err) {
        logger_1.logger.error('💥 Database Health Check Failed:', err);
    }
    try {
        // Check Redis
        const redisClient = redis_1.redisManager.getClient();
        const pong = await redisClient.ping();
        if (pong === 'PONG') {
            redisHealthy = true;
        }
    }
    catch (err) {
        logger_1.logger.error('💥 Redis Health Check Failed:', err);
    }
    try {
        // Check BullMQ Queue Client Connection
        const client = await queue_1.backgroundQueue.client;
        if (client.status === 'ready' || client.status === 'connecting') {
            queueHealthy = true;
        }
    }
    catch (err) {
        logger_1.logger.error('💥 BullMQ Health Check Failed:', err);
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
    }
    else {
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
exports.healthRouter.get('/', async (_req, res) => {
    let dbHealthy = false;
    let redisHealthy = false;
    let queueHealthy = false;
    try {
        await db_1.prisma.$queryRaw `SELECT 1`;
        dbHealthy = true;
    }
    catch (err) {
        logger_1.logger.warn('Database health check failed');
    }
    try {
        const pong = await redis_1.redisManager.getClient().ping();
        if (pong === 'PONG')
            redisHealthy = true;
    }
    catch (err) {
        logger_1.logger.warn('Redis health check failed');
    }
    try {
        const client = await queue_1.backgroundQueue.client;
        if (client.status === 'ready' || client.status === 'connecting') {
            queueHealthy = true;
        }
    }
    catch (err) {
        logger_1.logger.warn('Queue health check failed');
    }
    // Socket Server diagnostics
    const io = (0, socket_handler_1.getIoServer)();
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
