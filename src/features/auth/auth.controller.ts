import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../core/db';
import { config } from '../../core/config';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../core/errors';

// Helper to sign JWTs
function generateTokens(userId: string, email: string, name: string, sessionId: string) {
  const accessToken = jwt.sign(
    { userId, email, name, sessionId },
    config.JWT_SECRET,
    { expiresIn: '15m' },
  );

  const refreshToken = jwt.sign(
    { sessionId, jti: uuidv4() },
    config.JWT_REFRESH_SECRET,
    { expiresIn: '7d' },
  );

  return { accessToken, refreshToken };
}

// 1. Register User
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password, deviceId, age } = req.body;

    // Check if email already registered
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('Email is already registered', 'EMAIL_ALREADY_EXISTS');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create User, Profile and VerificationState in transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          profile: {
            create: {
              age,
              trustScore: 30, // Default base score
              isIdentityVerified: false,
              isPhoneVerified: false,
              completedTripsCount: 0,
            },
          },
          verification: {
            create: {},
          },
          notificationPreference: {
            create: {},
          },
        },
        include: {
          profile: true,
          verification: true,
        },
      });
      return user;
    });

    // Create Session
    const activeDeviceId = deviceId || uuidv4();
    const session = await prisma.session.create({
      data: {
        userId: newUser.id,
        deviceId: activeDeviceId,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.socket.remoteAddress,
      },
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(
      newUser.id,
      newUser.email,
      newUser.name,
      session.id,
    );

    // Save refresh token to db
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        sessionId: session.id,
        expiresAt,
      },
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          profile: newUser.profile,
          verification: newUser.verification,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

// 2. Login User
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, deviceId } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        verification: true,
      },
    });

    if (!user || user.isDeleted) {
      throw new UnauthorizedError('Email or password is incorrect', 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Email or password is incorrect', 'INVALID_CREDENTIALS');
    }

    const activeDeviceId = deviceId || uuidv4();

    // Remove any stale session for this user/device combination
    await prisma.session.deleteMany({
      where: {
        userId: user.id,
        deviceId: activeDeviceId,
      },
    });

    // Create Session
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        deviceId: activeDeviceId,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.socket.remoteAddress,
      },
    });

    // Generate Tokens
    const { accessToken, refreshToken } = generateTokens(
      user.id,
      user.email,
      user.name,
      session.id,
    );

    // Save refresh token to db
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        sessionId: session.id,
        expiresAt,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profile: user.profile,
          verification: user.verification,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

// 3. Refresh Tokens
export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken: oldToken } = req.body;

    let payload: { sessionId: string };
    try {
      payload = jwt.verify(oldToken, config.JWT_REFRESH_SECRET) as { sessionId: string };
    } catch {
      throw new UnauthorizedError('Invalid refresh token', 'REFRESH_TOKEN_INVALID');
    }

    // Look up refresh token in database
    const dbToken = await prisma.refreshToken.findUnique({
      where: { token: oldToken },
      include: {
        session: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!dbToken || dbToken.isRevoked || dbToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token is expired or revoked', 'REFRESH_TOKEN_EXPIRED');
    }

    // Revoke/Delete old refresh token (Strict rotation)
    await prisma.refreshToken.delete({
      where: { token: oldToken },
    });

    // Update Session last active status
    const session = await prisma.session.update({
      where: { id: dbToken.sessionId },
      data: { lastActiveAt: new Date() },
    });

    // Generate new token pair
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      dbToken.session.user.id,
      dbToken.session.user.email,
      dbToken.session.user.name,
      session.id,
    );

    // Save new refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        sessionId: session.id,
        expiresAt,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

// 4. Logout User
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = req.sessionId;

    if (!sessionId) {
      throw new UnauthorizedError('Session identification missing', 'SESSION_MISSING');
    }

    // Cascade delete session and associated refresh tokens
    await prisma.session.delete({
      where: { id: sessionId },
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      data: {},
    });
  } catch (err) {
    next(err);
  }
}

// 5. Get Current User (/me)
export async function getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedError('User credentials not found in request context', 'USER_MISSING');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        verification: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User account not found', 'USER_NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      message: 'Current user details retrieved',
      data: {
        user: {
          id: user.id,
          name: user.name,
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
