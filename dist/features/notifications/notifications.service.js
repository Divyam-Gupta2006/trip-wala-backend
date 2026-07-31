"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const notifications_repository_1 = require("./notifications.repository");
const socket_handler_1 = require("../messaging/socket.handler");
const logger_1 = require("../../core/logger");
class NotificationsService {
    repo = new notifications_repository_1.NotificationsRepository();
    // Helper to map event type to user preference category
    getPreferenceCategory(type) {
        switch (type) {
            case 'new_message':
            case 'chat_mention':
            case 'chat_reply':
                return 'chat';
            case 'trip_member_joined':
            case 'trip_member_left':
            case 'trip_updated':
            case 'trip_cancelled':
            case 'trip_organizer_announcement':
            case 'expense_created':
            case 'expense_updated':
            case 'expense_deleted':
            case 'settlement_requested':
            case 'settlement_completed':
                return 'trips';
            case 'invitation_received':
            case 'invitation_accepted':
            case 'invitation_declined':
                return 'invitations';
            case 'application_submitted':
            case 'application_accepted':
            case 'application_rejected':
                return 'applications';
            case 'system_notification':
                return 'system';
            default:
                return 'system';
        }
    }
    // Publish a new notification event
    async publish(event) {
        try {
            const category = this.getPreferenceCategory(event.type);
            const preferences = await this.repo.getPreferences(event.userId);
            // Check if user has opted out of this notification category
            if (preferences && !preferences[category]) {
                logger_1.logger.info(`Notification skipped for user ${event.userId} due to preference: ${category} = false`);
                return null;
            }
            // Create database record
            const notification = await this.repo.createNotification(event);
            // Broadcast real-time Socket.IO event to all recipient's active devices
            const io = (0, socket_handler_1.getIoServer)();
            if (io) {
                const unreadCount = await this.repo.getUnreadCount(event.userId);
                const roomName = `user:${event.userId}`;
                io.to(roomName).emit('notification:new', notification);
                io.to(roomName).emit('notification:count', { count: unreadCount });
                logger_1.logger.info(`Real-time notification emitted to room ${roomName} (type: ${event.type})`);
            }
            return notification;
        }
        catch (err) {
            logger_1.logger.error(`Failed to publish notification: ${err.message}`, err);
            throw err;
        }
    }
    // Get specific notification by ID
    async getNotificationById(id) {
        return this.repo.getNotificationById(id);
    }
    // Fetch paginated notifications
    async getUserNotifications(userId, limit, cursor) {
        return this.repo.getUserNotifications(userId, limit, cursor);
    }
    // Fetch unread notifications
    async getUnreadNotifications(userId) {
        return this.repo.getUnreadNotifications(userId);
    }
    // Fetch unread count
    async getUnreadCount(userId) {
        return this.repo.getUnreadCount(userId);
    }
    // Mark a specific notification as read
    async markAsRead(id, userId) {
        const updated = await this.repo.markAsRead(id, userId);
        // Broadcast update
        const io = (0, socket_handler_1.getIoServer)();
        if (io) {
            const unreadCount = await this.repo.getUnreadCount(userId);
            const roomName = `user:${userId}`;
            io.to(roomName).emit('notification:updated', updated);
            io.to(roomName).emit('notification:read', { id });
            io.to(roomName).emit('notification:count', { count: unreadCount });
        }
        return updated;
    }
    // Mark all notifications as read for a user
    async markAllAsRead(userId) {
        await this.repo.markAllAsRead(userId);
        // Broadcast count reset and batch update
        const io = (0, socket_handler_1.getIoServer)();
        if (io) {
            const roomName = `user:${userId}`;
            io.to(roomName).emit('notification:count', { count: 0 });
            io.to(roomName).emit('notification:updated', { allRead: true });
        }
    }
    // Soft delete a notification
    async softDelete(id, userId) {
        await this.repo.softDelete(id, userId);
        // Broadcast delete event
        const io = (0, socket_handler_1.getIoServer)();
        if (io) {
            const unreadCount = await this.repo.getUnreadCount(userId);
            const roomName = `user:${userId}`;
            io.to(roomName).emit('notification:deleted', { id });
            io.to(roomName).emit('notification:count', { count: unreadCount });
        }
    }
    // Get preferences
    async getPreferences(userId) {
        return this.repo.getPreferences(userId);
    }
    // Update preferences
    async updatePreferences(userId, data) {
        return this.repo.updatePreferences(userId, data);
    }
}
exports.NotificationsService = NotificationsService;
