"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const config_1 = require("./core/config");
const middlewares_1 = require("./core/middlewares");
const errors_1 = require("./core/errors");
const health_1 = require("./core/health");
const auth_routes_1 = require("./features/auth/auth.routes");
const users_routes_1 = require("./features/users/users.routes");
const profiles_routes_1 = require("./features/profiles/profiles.routes");
const trips_routes_1 = require("./features/trips/trips.routes");
const memberships_routes_1 = require("./features/memberships/memberships.routes");
const messaging_routes_1 = require("./features/messaging/messaging.routes");
const notifications_routes_1 = require("./features/notifications/notifications.routes");
const expenses_routes_1 = require("./features/expenses/expenses.routes");
const trust_routes_1 = require("./features/trust/trust.routes");
const swagger_1 = require("./core/swagger");
const app = (0, express_1.default)();
// 1. Security Headers & CORS
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: config_1.config.CORS_ORIGIN === '*' ? '*' : config_1.config.CORS_ORIGIN.split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
}));
// 2. Body Parsers
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// 3. Request Context & ID injection
app.use(middlewares_1.requestIdMiddleware);
app.use(middlewares_1.requestLoggerMiddleware);
// 4. Rate Limiter Configuration
const limiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.config.RATE_LIMIT_WINDOW_MS,
    max: config_1.config.RATE_LIMIT_MAX,
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
app.use('/health', health_1.healthRouter);
// 6. Swagger API Documentation Route
app.use('/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
// 7. API Version 1 Routes
app.use('/api/v1/auth', auth_routes_1.authRouter);
app.use('/api/v1/users', users_routes_1.usersRouter);
app.use('/api/v1/profiles', profiles_routes_1.profilesRouter);
app.use('/api/v1/trips', trips_routes_1.tripsRouter);
app.use('/api/v1', memberships_routes_1.membershipsRouter);
app.use('/api/v1/conversations', messaging_routes_1.messagingRouter);
app.use('/api/v1/notifications', notifications_routes_1.notificationsRouter);
app.use('/api/v1/trips/:tripId/expenses', expenses_routes_1.expensesRouter);
app.use('/api/v1/trips/:tripId/balances', expenses_routes_1.balancesRouter);
app.use('/api/v1/trips/:tripId/settlements', expenses_routes_1.settlementsRouter);
app.use('/api/v1/trust', trust_routes_1.trustRouter);
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
app.use(errors_1.errorHandler);
exports.default = app;
