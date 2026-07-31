import { prisma } from '../../shared/database/prisma';
import { UpdateProfileInput } from './profiles.dto';

export class ProfilesService {
  async getProfile(userId: string) {
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        profile: true,
        trustScore: true,
        createdAt: true,
      },
    });

    if (!profile) {
      throw { status: 404, message: 'Profile not found' };
    }

    return profile;
  }

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const updatedProfile = await prisma.profile.update({
      where: { userId },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            trustScore: true,
          }
        }
      }
    });

    return updatedProfile;
  }

  async getTrustScore(userId: string) {
    const trustScore = await prisma.trustScore.findUnique({
      where: { userId },
    });

    if (!trustScore) {
      throw { status: 404, message: 'Trust score not found' };
    }

    return trustScore;
  }
}
