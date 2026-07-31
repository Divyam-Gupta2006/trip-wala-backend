import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ZodSchema, ZodError, ZodTypeAny } from 'zod';
import jwt from 'jsonwebtoken';
import { logger } from './logger';
import { config } from './config';
import { prisma } from './db';
import { BadRequestError, UnauthorizedError } from './errors';

// 1. Request ID Middleware
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

// 2. Request Logger Middleware
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;
  const requestId = req.requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    logger.info({
      requestId,
      method,
      url: originalUrl,
      statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id || null,
      sessionId: req.sessionId || null,
    }, `HTTP ${method} ${originalUrl} ${statusCode} in ${duration}ms`);
  });

  next();
}

// 3. Validation Middlewares
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw formatZodValidationError(result.error);
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      throw formatZodValidationError(result.error);
    }
    req.query = result.data as any;
    next();
  };
}

export function validateParams(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      throw formatZodValidationError(result.error);
    }
    req.params = result.data as any;
    next();
  };
}

function formatZodValidationError(error: ZodError): BadRequestError {
  const issues = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
  return new BadRequestError(`Validation failed: ${issues}`, 'VALIDATION_ERROR');
}

// 4. Authorization Middleware
interface TokenPayload {
  userId: string;
  email: string;
  name: string;
  sessionId: string;
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed authorization token', 'TOKEN_MISSING'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as TokenPayload;

    // Verify session exists in PostgreSQL
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
      include: { user: true },
    });

    if (!session || session.user.isDeleted) {
      return next(new UnauthorizedError('Active session not found or has expired', 'SESSION_EXPIRED'));
    }

    // Attach user and session context
    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    };
    req.sessionId = session.id;

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError('Authorization token has expired', 'TOKEN_EXPIRED'));
    }
    return next(new UnauthorizedError('Invalid authorization token', 'TOKEN_INVALID'));
  }
}
