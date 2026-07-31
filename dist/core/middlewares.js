"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = requestIdMiddleware;
exports.requestLoggerMiddleware = requestLoggerMiddleware;
exports.validateBody = validateBody;
exports.validateQuery = validateQuery;
exports.validateParams = validateParams;
exports.authMiddleware = authMiddleware;
const uuid_1 = require("uuid");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("./logger");
const config_1 = require("./config");
const db_1 = require("./db");
const errors_1 = require("./errors");
// 1. Request ID Middleware
function requestIdMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
}
// 2. Request Logger Middleware
function requestLoggerMiddleware(req, res, next) {
    const start = Date.now();
    const { method, originalUrl } = req;
    const requestId = req.requestId;
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;
        logger_1.logger.info({
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
function validateBody(schema) {
    return (req, _res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            throw formatZodValidationError(result.error);
        }
        req.body = result.data;
        next();
    };
}
function validateQuery(schema) {
    return (req, _res, next) => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            throw formatZodValidationError(result.error);
        }
        req.query = result.data;
        next();
    };
}
function validateParams(schema) {
    return (req, _res, next) => {
        const result = schema.safeParse(req.params);
        if (!result.success) {
            throw formatZodValidationError(result.error);
        }
        req.params = result.data;
        next();
    };
}
function formatZodValidationError(error) {
    const issues = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
    return new errors_1.BadRequestError(`Validation failed: ${issues}`, 'VALIDATION_ERROR');
}
async function authMiddleware(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new errors_1.UnauthorizedError('Missing or malformed authorization token', 'TOKEN_MISSING'));
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET);
        // Verify session exists in PostgreSQL
        const session = await db_1.prisma.session.findUnique({
            where: { id: decoded.sessionId },
            include: { user: true },
        });
        if (!session || session.user.isDeleted) {
            return next(new errors_1.UnauthorizedError('Active session not found or has expired', 'SESSION_EXPIRED'));
        }
        // Attach user and session context
        req.user = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
        };
        req.sessionId = session.id;
        next();
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            return next(new errors_1.UnauthorizedError('Authorization token has expired', 'TOKEN_EXPIRED'));
        }
        return next(new errors_1.UnauthorizedError('Invalid authorization token', 'TOKEN_INVALID'));
    }
}
