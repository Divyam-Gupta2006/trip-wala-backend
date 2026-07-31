"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserNotifications = getUserNotifications;
exports.getUnreadNotifications = getUnreadNotifications;
exports.getUnreadCount = getUnreadCount;
exports.markAsRead = markAsRead;
exports.markAllAsRead = markAllAsRead;
exports.softDelete = softDelete;
exports.getPreferences = getPreferences;
exports.updatePreferences = updatePreferences;
const notifications_service_1 = require("./notifications.service");
const notifications_schemas_1 = require("./notifications.schemas");
const errors_1 = require("../../core/errors");
const service = new notifications_service_1.NotificationsService();
// Get paginated notifications for active user
async function getUserNotifications(req, res, next) {
    try {
        const userId = req.user.id;
        const { limit, cursor } = notifications_schemas_1.paginationQuerySchema.parse(req.query);
        const result = await service.getUserNotifications(userId, limit, cursor);
        res.status(200).json({
            status: 'success',
            data: result,
        });
    }
    catch (err) {
        next(err);
    }
}
// Get unread notifications
async function getUnreadNotifications(req, res, next) {
    try {
        const userId = req.user.id;
        const notifications = await service.getUnreadNotifications(userId);
        res.status(200).json({
            status: 'success',
            data: notifications,
        });
    }
    catch (err) {
        next(err);
    }
}
// Get unread notifications count
async function getUnreadCount(req, res, next) {
    try {
        const userId = req.user.id;
        const count = await service.getUnreadCount(userId);
        res.status(200).json({
            status: 'success',
            data: { count },
        });
    }
    catch (err) {
        next(err);
    }
}
// Mark single notification as read
async function markAsRead(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const notification = await service.getNotificationById(id);
        if (!notification || notification.isDeleted) {
            throw new errors_1.NotFoundError('Notification not found');
        }
        if (notification.userId !== userId) {
            throw new errors_1.ForbiddenError('You are not authorized to view or modify this notification');
        }
        const updated = await service.markAsRead(id, userId);
        res.status(200).json({
            status: 'success',
            data: updated,
        });
    }
    catch (err) {
        next(err);
    }
}
// Mark all notifications as read
async function markAllAsRead(req, res, next) {
    try {
        const userId = req.user.id;
        await service.markAllAsRead(userId);
        res.status(200).json({
            status: 'success',
            message: 'All notifications marked as read',
        });
    }
    catch (err) {
        next(err);
    }
}
// Soft delete notification
async function softDelete(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const notification = await service.getNotificationById(id);
        if (!notification || notification.isDeleted) {
            throw new errors_1.NotFoundError('Notification not found');
        }
        if (notification.userId !== userId) {
            throw new errors_1.ForbiddenError('You are not authorized to view or modify this notification');
        }
        await service.softDelete(id, userId);
        res.status(200).json({
            status: 'success',
            message: 'Notification deleted successfully',
        });
    }
    catch (err) {
        next(err);
    }
}
// Get user notification preferences
async function getPreferences(req, res, next) {
    try {
        const userId = req.user.id;
        const preferences = await service.getPreferences(userId);
        res.status(200).json({
            status: 'success',
            data: preferences,
        });
    }
    catch (err) {
        next(err);
    }
}
// Update user notification preferences
async function updatePreferences(req, res, next) {
    try {
        const userId = req.user.id;
        const validatedData = notifications_schemas_1.updatePreferencesSchema.parse(req.body);
        const preferences = await service.updatePreferences(userId, validatedData);
        res.status(200).json({
            status: 'success',
            data: preferences,
        });
    }
    catch (err) {
        next(err);
    }
}
