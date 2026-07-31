import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/db';
import { NotFoundError, ForbiddenError } from '../../core/errors';

// 1. Get User by ID
export async function getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        verification: true,
      },
    });

    if (!user || user.isDeleted) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: {
        user: {
          id: user.id,
          name: user.name,
          username: user.username || null,
          email: user.email,
          profile: user.profile,
          verification: user.verification,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

// 2. Soft Delete User Account
export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id;

    // Authorization: User can only delete their own account
    if (currentUserId !== id) {
      throw new ForbiddenError('You can only delete your own account', 'FORBIDDEN_USER_DELETE');
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user || user.isDeleted) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Execute soft delete and session cleanup in transaction
    await prisma.$transaction(async (tx) => {
      // 1. Mark user as deleted
      await tx.user.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      // 2. Revoke all active sessions (which cascade-deletes all refresh tokens)
      await tx.session.deleteMany({
        where: { userId: id },
      });
    });

    res.status(200).json({
      success: true,
      message: 'Account deleted and logged out successfully',
      data: {},
    });
  } catch (err) {
    next(err);
  }
}
