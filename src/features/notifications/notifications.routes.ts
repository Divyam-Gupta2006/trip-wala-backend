import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares';
import {
  getUserNotifications,
  getUnreadNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  softDelete,
  getPreferences,
  updatePreferences,
} from './notifications.controller';

export const notificationsRouter = Router();

// Protect all routes with authMiddleware
notificationsRouter.use(authMiddleware);

notificationsRouter.get('/', getUserNotifications);
notificationsRouter.get('/unread', getUnreadNotifications);
notificationsRouter.get('/unread-count', getUnreadCount);
notificationsRouter.post('/:id/read', markAsRead);
notificationsRouter.post('/read-all', markAllAsRead);
notificationsRouter.delete('/:id', softDelete);
notificationsRouter.get('/preferences', getPreferences);
notificationsRouter.put('/preferences', updatePreferences);
