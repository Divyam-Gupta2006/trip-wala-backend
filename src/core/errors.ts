import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad Request', code = 'BAD_REQUEST') {
    super(400, code, message);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not Found', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(409, code, message);
  }
}

export class InternalServerError extends ApiError {
  constructor(message = 'Internal Server Error', code = 'INTERNAL_ERROR') {
    super(500, code, message);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.headers['x-request-id'] as string || 'unknown';
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
  const isProduction = process.env.NODE_ENV === 'production';
  const message = (statusCode === 500 && isProduction)
    ? 'An unexpected error occurred'
    : (err.message || 'An unexpected error occurred');

  if (statusCode >= 500) {
    logger.error({
      err,
      requestId,
      url: req.originalUrl,
      method: req.method,
    }, '🔥 Internal Server Error');
  } else {
    logger.warn({
      code,
      message,
      requestId,
      url: req.originalUrl,
      method: req.method,
    }, '⚠️ Request Error');
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
    requestId,
  });
}
