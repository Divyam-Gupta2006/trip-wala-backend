import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { config } from './core/config';
import { requestIdMiddleware, requestLoggerMiddleware } from './core/middlewares';
import { errorHandler } from './core/errors';
import { healthRouter } from './core/health';
import { authRouter } from './features/auth/auth.routes';
import { usersRouter } from './features/users/users.routes';
import { profilesRouter } from './features/profiles/profiles.routes';
import { tripsRouter } from './features/trips/trips.routes';
import { membershipsRouter } from './features/memberships/memberships.routes';
import { messagingRouter } from './features/messaging/messaging.routes';
import { notificationsRouter } from './features/notifications/notifications.routes';
import { expensesRouter, balancesRouter, settlementsRouter } from './features/expenses/expenses.routes';
import { trustRouter } from './features/trust/trust.routes';
import { swaggerSpec } from './core/swagger';

const app = express();

// 1. Security Headers & CORS
app.use(helmet());
app.use(
  cors({
    origin: config.CORS_ORIGIN === '*' ? '*' : config.CORS_ORIGIN.split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  }),
);

// 2. Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Request Context & ID injection
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// 4. Rate Limiter Configuration
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests, please try again later.',
    },
  },
});
app.use(limiter);

// 5. Health Check Routes (Outside /api/v1 prefix for direct infrastructure routing)
app.use('/health', healthRouter);

// 6. Swagger API Documentation Route
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 7. API Version 1 Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/profiles', profilesRouter);
app.use('/api/v1/trips', tripsRouter);
app.use('/api/v1', membershipsRouter);
app.use('/api/v1/conversations', messagingRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/trips/:tripId/expenses', expensesRouter);
app.use('/api/v1/trips/:tripId/balances', balancesRouter);
app.use('/api/v1/trips/:tripId/settlements', settlementsRouter);
app.use('/api/v1/trust', trustRouter);

// 8. Handle 404 Route Not Found
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'The requested route was not found on this server.',
    },
    requestId: _req.requestId,
  });
});

// 9. Global Exception Catch Handler
app.use(errorHandler);

export default app;
