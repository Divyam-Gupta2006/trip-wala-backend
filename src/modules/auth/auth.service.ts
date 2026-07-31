import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../shared/database/prisma';
import { RegisterInput, LoginInput } from './auth.dto';
import { logger } from '../../shared/logger';

export class AuthService {
  private generateTokens(userId: string) {
    const accessToken = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET as string,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    const refreshToken = jwt.sign(
      { id: userId },
      process.env.JWT_REFRESH_SECRET as string,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    return { accessToken, refreshToken };
  }

  async register(data: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw { status: 400, message: 'Email already in use' };
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        profile: {
          create: {
            bio: '',
            travelStyles: [],
          },
        },
        trustScore: {
          create: {
            score: 50,
          },
        },
      },
    });

    const tokens = this.generateTokens(user.id);
    
    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return { user: this.excludeHash(user), tokens };
  }

  async login(data: LoginInput, device?: string, ipAddress?: string) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw { status: 401, message: 'Invalid credentials' };
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw { status: 401, message: 'Invalid credentials' };
    }

    const tokens = this.generateTokens(user.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Run session creation and token storage concurrently
    await Promise.all([
      prisma.refreshToken.create({
        data: {
          token: tokens.refreshToken,
          userId: user.id,
          expiresAt,
        },
      }),
      prisma.session.create({
        data: {
          userId: user.id,
          device,
          ipAddress,
        },
      }),
    ]);

    return { user: this.excludeHash(user), tokens };
  }

  async refresh(oldRefreshToken: string) {
    try {
      const decoded = jwt.verify(oldRefreshToken, process.env.JWT_REFRESH_SECRET as string) as { id: string };
      
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: oldRefreshToken },
      });

      if (!storedToken) {
        throw { status: 401, message: 'Refresh token invalid or revoked' };
      }

      const tokens = this.generateTokens(decoded.id);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Rotate refresh token securely
      await prisma.$transaction([
        prisma.refreshToken.delete({ where: { token: oldRefreshToken } }),
        prisma.refreshToken.create({
          data: {
            token: tokens.refreshToken,
            userId: decoded.id,
            expiresAt,
          },
        }),
      ]);

      return {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (e) {
      throw { status: 401, message: 'Invalid refresh token' };
    }
  }

  async logout(refreshToken: string) {
    try {
      await prisma.refreshToken.delete({
        where: { token: refreshToken },
      });
    } catch (e) {
      logger.warn('Failed to delete refresh token on logout, might already be deleted');
    }
  }

  private excludeHash(user: any) {
    const { passwordHash, ...userWithoutHash } = user;
    return userWithoutHash;
  }
}
