import { prisma } from '../../core/db';
import { redisManager } from '../../core/redis';
import { logger } from '../../core/logger';

export class NotificationsRepository {
  // Create a notification record
  async createNotification(data: {
    userId: string;
    actorId?: string;
    type: string;
    title: string;
    body: string;
    relatedEntityId?: string;
    relatedEntityType?: string;
    metadata?: any;
  }) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        actorId: data.actorId || null,
        type: data.type,
        title: data.title,
        body: data.body,
        relatedEntityId: data.relatedEntityId || null,
        relatedEntityType: data.relatedEntityType || null,
        metadata: data.metadata || {},
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  // Get specific notification by ID
  async getNotificationById(id: string) {
    return prisma.notification.findUnique({
      where: { id },
    });
  }

  // Get user notifications (cursor-based pagination)
  async getUserNotifications(userId: string, limit: number, cursor?: string) {
    const queryOptions: any = {
      where: {
        userId,
        isDeleted: false,
      },
      take: limit + 1, // Fetch extra one to determine next cursor
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
      },
    };

    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1; // Skip the cursor itself
    }

    const items = await prisma.notification.findMany(queryOptions);

    let nextCursor: string | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id;
    }

    return {
      items,
      nextCursor,
    };
  }

  // Get unread notifications
  async getUnreadNotifications(userId: string) {
    return prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
        isDeleted: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  // Get unread notifications count
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
        isDeleted: false,
      },
    });
  }

  // Mark single notification as read
  async markAsRead(id: string, userId: string) {
    return prisma.notification.update({
      where: { id, userId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        isDeleted: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  // Soft delete a notification
  async softDelete(id: string, userId: string) {
    return prisma.notification.update({
      where: { id, userId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  // Get or initialize user notification preferences
  async getPreferences(userId: string) {
    const redis = redisManager.getClient();
    const cacheKey = `cache:preferences:${userId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      // Fail-silent on redis cache read error to preserve database fallback
      logger.warn(`Failed to read notification preferences cache for user ${userId}:`, err);
    }

    // We use findUnique. If it doesn't exist, we auto-create it with default true values
    let preferences = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      preferences = await prisma.notificationPreference.create({
        data: { userId },
      });
    }

    try {
      await redis.set(cacheKey, JSON.stringify(preferences), 'EX', 3600); // 1 hour TTL
    } catch (err) {
      logger.warn(`Failed to cache notification preferences for user ${userId}:`, err);
    }

    return preferences;
  }

  // Update notification preferences
  async updatePreferences(
    userId: string,
    data: {
      chat?: boolean;
      trips?: boolean;
      invitations?: boolean;
      applications?: boolean;
      marketing?: boolean;
      system?: boolean;
    }
  ) {
    const preferences = await prisma.notificationPreference.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data,
      },
    });

    // Invalidate Redis cache
    const redis = redisManager.getClient();
    const cacheKey = `cache:preferences:${userId}`;
    try {
      await redis.del(cacheKey);
    } catch (err) {
      logger.warn(`Failed to invalidate notification preferences cache for user ${userId}:`, err);
    }

    return preferences;
  }
}
