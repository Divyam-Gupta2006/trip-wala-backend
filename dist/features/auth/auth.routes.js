"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_schemas_1 = require("./auth.schemas");
const middlewares_1 = require("../../core/middlewares");
exports.authRouter = (0, express_1.Router)();
// Public routes
exports.authRouter.post('/register', (0, middlewares_1.validateBody)(auth_schemas_1.registerSchema), auth_controller_1.register);
exports.authRouter.post('/login', (0, middlewares_1.validateBody)(auth_schemas_1.loginSchema), auth_controller_1.login);
exports.authRouter.post('/refresh', (0, middlewares_1.validateBody)(auth_schemas_1.refreshSchema), auth_controller_1.refresh);
// Protected routes
exports.authRouter.post('/logout', middlewares_1.authMiddleware, auth_controller_1.logout);
exports.authRouter.get('/me', middlewares_1.authMiddleware, auth_controller_1.getCurrentUser);
