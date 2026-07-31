"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalServerError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.ApiError = void 0;
exports.errorHandler = errorHandler;
const logger_1 = require("./logger");
class ApiError extends Error {
    statusCode;
    code;
    constructor(statusCode, code, message) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.ApiError = ApiError;
class BadRequestError extends ApiError {
    constructor(message = 'Bad Request', code = 'BAD_REQUEST') {
        super(400, code, message);
    }
}
exports.BadRequestError = BadRequestError;
class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
        super(401, code, message);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends ApiError {
    constructor(message = 'Forbidden', code = 'FORBIDDEN') {
        super(403, code, message);
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends ApiError {
    constructor(message = 'Not Found', code = 'NOT_FOUND') {
        super(404, code, message);
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends ApiError {
    constructor(message = 'Conflict', code = 'CONFLICT') {
        super(409, code, message);
    }
}
exports.ConflictError = ConflictError;
class InternalServerError extends ApiError {
    constructor(message = 'Internal Server Error', code = 'INTERNAL_ERROR') {
        super(500, code, message);
    }
}
exports.InternalServerError = InternalServerError;
function errorHandler(err, req, res, _next) {
    const requestId = req.headers['x-request-id'] || 'unknown';
    const statusCode = err instanceof ApiError ? err.statusCode : 500;
    const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
    const isProduction = process.env.NODE_ENV === 'production';
    const message = (statusCode === 500 && isProduction)
        ? 'An unexpected error occurred'
        : (err.message || 'An unexpected error occurred');
    if (statusCode >= 500) {
        logger_1.logger.error({
            err,
            requestId,
            url: req.originalUrl,
            method: req.method,
        }, '🔥 Internal Server Error');
    }
    else {
        logger_1.logger.warn({
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
