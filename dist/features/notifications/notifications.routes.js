"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = require("express");
const middlewares_1 = require("../../core/middlewares");
const notifications_controller_1 = require("./notifications.controller");
exports.notificationsRouter = (0, express_1.Router)();
// Protect all routes with authMiddleware
exports.notificationsRouter.use(middlewares_1.authMiddleware);
exports.notificationsRouter.get('/', notifications_controller_1.getUserNotifications);
exports.notificationsRouter.get('/unread', notifications_controller_1.getUnreadNotifications);
exports.notificationsRouter.get('/unread-count', notifications_controller_1.getUnreadCount);
exports.notificationsRouter.post('/:id/read', notifications_controller_1.markAsRead);
exports.notificationsRouter.post('/read-all', notifications_controller_1.markAllAsRead);
exports.notificationsRouter.delete('/:id', notifications_controller_1.softDelete);
exports.notificationsRouter.get('/preferences', notifications_controller_1.getPreferences);
exports.notificationsRouter.put('/preferences', notifications_controller_1.updatePreferences);
