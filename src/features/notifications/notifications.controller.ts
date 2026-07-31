import { Request, Response, NextFunction } from 'express';
import { NotificationsService } from './notifications.service';
import { paginationQuerySchema, updatePreferencesSchema } from './notifications.schemas';
import { NotFoundError, ForbiddenError } from '../../core/errors';

const service = new NotificationsService();

// Get paginated notifications for active user
export async function getUserNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { limit, cursor } = paginationQuerySchema.parse(req.query);

    const result = await service.getUserNotifications(userId, limit, cursor);

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

// Get unread notifications
export async function getUnreadNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const notifications = await service.getUnreadNotifications(userId);

    res.status(200).json({
      status: 'success',
      data: notifications,
    });
  } catch (err) {
    next(err);
  }
}

// Get unread notifications count
export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const count = await service.getUnreadCount(userId);

    res.status(200).json({
      status: 'success',
      data: { count },
    });
  } catch (err) {
    next(err);
  }
}

// Mark single notification as read
export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const notification = await service.getNotificationById(id);
    if (!notification || notification.isDeleted) {
      throw new NotFoundError('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenError('You are not authorized to view or modify this notification');
    }

    const updated = await service.markAsRead(id, userId);

    res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

// Mark all notifications as read
export async function markAllAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    await service.markAllAsRead(userId);

    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read',
    });
  } catch (err) {
    next(err);
  }
}

// Soft delete notification
export async function softDelete(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const notification = await service.getNotificationById(id);
    if (!notification || notification.isDeleted) {
      throw new NotFoundError('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenError('You are not authorized to view or modify this notification');
    }

    await service.softDelete(id, userId);

    res.status(200).json({
      status: 'success',
      message: 'Notification deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

// Get user notification preferences
export async function getPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const preferences = await service.getPreferences(userId);

    res.status(200).json({
      status: 'success',
      data: preferences,
    });
  } catch (err) {
    next(err);
  }
}

// Update user notification preferences
export async function updatePreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const validatedData = updatePreferencesSchema.parse(req.body);

    const preferences = await service.updatePreferences(userId, validatedData);

    res.status(200).json({
      status: 'success',
      data: preferences,
    });
  } catch (err) {
    next(err);
  }
}
