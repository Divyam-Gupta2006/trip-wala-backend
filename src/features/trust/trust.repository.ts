import { prisma } from '../../core/db';
import { VerificationStatus, Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient | typeof prisma;

export class TrustRepository {
  // ─── Ratings ────────────────────────────────────────────────────────────────

  async createRating(
    data: {
      tripId: string;
      raterId: string;
      rateeId: string;
      reliability: number;
      communication: number;
      respectfulness: number;
      socialCompatibility: number;
      funToTravelWith: number;
      planningContribution: number;
      review?: string | null;
    },
    tx: TxClient = prisma
  ) {
    return tx.rating.create({
      data,
      include: {
        rater: {
          select: {
            id: true,
            name: true,
            profile: { select: { avatarUrl: true } },
          },
        },
        ratee: {
          select: {
            id: true,
            name: true,
            profile: { select: { avatarUrl: true } },
          },
        },
      },
    });
  }

  async findRatingById(id: string, tx: TxClient = prisma) {
    return tx.rating.findUnique({
      where: { id },
    });
  }

  async findRatingByTripAndRaterAndRatee(
    tripId: string,
    raterId: string,
    rateeId: string,
    tx: TxClient = prisma
  ) {
    return tx.rating.findUnique({
      where: {
        tripId_raterId_rateeId: {
          tripId,
          raterId,
          rateeId,
        },
      },
    });
  }

  async findRatingsForUser(rateeId: string, options: { limit: number; cursor?: string }) {
    const queryOptions: Parameters<typeof prisma.rating.findMany>[0] = {
      where: { rateeId },
      take: options.limit + 1,
      orderBy: { createdAt: 'desc' },
      include: {
        rater: {
          select: {
            id: true,
            name: true,
            profile: { select: { avatarUrl: true } },
          },
        },
      },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const items = await prisma.rating.findMany(queryOptions);
    let nextCursor: string | undefined;
    if (items.length > options.limit) {
      nextCursor = items.pop()!.id;
    }
    return { items, nextCursor };
  }

  async getRatingAnalytics(rateeId: string) {
    const ratings = await prisma.rating.findMany({
      where: { rateeId },
    });

    if (ratings.length === 0) {
      return {
        averageRating: 0,
        totalRatings: 0,
        categories: {
          reliability: 0,
          communication: 0,
          respectfulness: 0,
          socialCompatibility: 0,
          funToTravelWith: 0,
          planningContribution: 0,
        },
        distribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
      };
    }

    let reliabilitySum = 0;
    let communicationSum = 0;
    let respectfulnessSum = 0;
    let socialCompatibilitySum = 0;
    let funToTravelWithSum = 0;
    let planningContributionSum = 0;
    let totalScoreSum = 0;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const r of ratings) {
      reliabilitySum += r.reliability;
      communicationSum += r.communication;
      respectfulnessSum += r.respectfulness;
      socialCompatibilitySum += r.socialCompatibility;
      funToTravelWithSum += r.funToTravelWith;
      planningContributionSum += r.planningContribution;

      const avg = (r.reliability + r.communication + r.respectfulness + r.socialCompatibility + r.funToTravelWith + r.planningContribution) / 6;
      totalScoreSum += avg;

      const rounded = Math.round(avg) as 1 | 2 | 3 | 4 | 5;
      if (distribution[rounded] !== undefined) {
        distribution[rounded]++;
      }
    }

    const count = ratings.length;
    return {
      averageRating: parseFloat((totalScoreSum / count).toFixed(2)),
      totalRatings: count,
      categories: {
        reliability: parseFloat((reliabilitySum / count).toFixed(2)),
        communication: parseFloat((communicationSum / count).toFixed(2)),
        respectfulness: parseFloat((respectfulnessSum / count).toFixed(2)),
        socialCompatibility: parseFloat((socialCompatibilitySum / count).toFixed(2)),
        funToTravelWith: parseFloat((funToTravelWithSum / count).toFixed(2)),
        planningContribution: parseFloat((planningContributionSum / count).toFixed(2)),
      },
      distribution,
    };
  }

  // ─── Verification ─────────────────────────────────────────────────────────────

  async findVerificationState(userId: string) {
    return prisma.verificationState.findUnique({
      where: { userId },
    });
  }

  async upsertVerificationState(
    userId: string,
    data: Prisma.VerificationStateCreateInput,
    tx: TxClient = prisma
  ) {
    return tx.verificationState.upsert({
      where: { userId },
      create: data,
      update: data,
    });
  }

  async updateVerificationState(
    userId: string,
    data: Prisma.VerificationStateUpdateInput,
    tx: TxClient = prisma
  ) {
    return tx.verificationState.update({
      where: { userId },
      data,
    });
  }

  // ─── Guardians ────────────────────────────────────────────────────────────────

  async createGuardian(
    userId: string,
    data: {
      name: string;
      phone: string;
      relationship: string;
      email?: string | null;
      notes?: string | null;
      isPrimaryEmergencyContact?: boolean;
    },
    tx: TxClient = prisma
  ) {
    // If setting as primary, unset other primary contacts first
    if (data.isPrimaryEmergencyContact) {
      await tx.guardian.updateMany({
        where: { userId, isPrimaryEmergencyContact: true },
        data: { isPrimaryEmergencyContact: false },
      });
    }

    return tx.guardian.create({
      data: {
        userId,
        ...data,
      },
    });
  }

  async findGuardianById(id: string) {
    return prisma.guardian.findUnique({
      where: { id },
    });
  }

  async findGuardiansByUser(userId: string) {
    return prisma.guardian.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateGuardian(
    id: string,
    userId: string,
    data: Partial<{
      name: string;
      phone: string;
      relationship: string;
      email: string | null;
      notes: string | null;
      isPrimaryEmergencyContact: boolean;
    }>,
    tx: TxClient = prisma
  ) {
    if (data.isPrimaryEmergencyContact) {
      await tx.guardian.updateMany({
        where: { userId, isPrimaryEmergencyContact: true },
        data: { isPrimaryEmergencyContact: false },
      });
    }

    return tx.guardian.update({
      where: { id },
      data,
    });
  }

  async deleteGuardian(id: string) {
    return prisma.guardian.delete({
      where: { id },
    });
  }

  // ─── Travel Memories ─────────────────────────────────────────────────────────

  async createMemory(
    userId: string,
    data: {
      title: string;
      description: string;
      destination?: string | null;
      tripId?: string | null;
      mediaUrl?: string | null;
      mediaUrls?: string[];
      visibility?: string;
      date?: Date;
    }
  ) {
    return prisma.travelMemory.create({
      data: {
        userId,
        ...data,
      },
    });
  }

  async findMemoryById(id: string) {
    return prisma.travelMemory.findUnique({
      where: { id },
    });
  }

  async findMemoriesByUser(
    userId: string,
    viewerId: string,
    options: { limit: number; cursor?: string }
  ) {
    // Determine visibility levels allowed
    // If viewer is self, they see all (public, friends, private)
    // If they are not self, they see public/friends (for simplicity we'll show public only to non-self, or we can check friendship status in future. Currently there is no Friend model, so non-self viewer sees 'public' only).
    const isSelf = userId === viewerId;
    const allowedVisibilities = isSelf ? ['public', 'friends', 'private'] : ['public'];

    const queryOptions: Parameters<typeof prisma.travelMemory.findMany>[0] = {
      where: {
        userId,
        visibility: { in: allowedVisibilities },
      },
      take: options.limit + 1,
      orderBy: { date: 'desc' },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const items = await prisma.travelMemory.findMany(queryOptions);
    let nextCursor: string | undefined;
    if (items.length > options.limit) {
      nextCursor = items.pop()!.id;
    }
    return { items, nextCursor };
  }

  async updateMemory(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      destination: string | null;
      tripId: string | null;
      mediaUrl: string | null;
      mediaUrls: string[];
      visibility: string;
      date: Date;
    }>
  ) {
    return prisma.travelMemory.update({
      where: { id },
      data,
    });
  }

  async deleteMemory(id: string) {
    return prisma.travelMemory.delete({
      where: { id },
    });
  }

  // ─── Trust Calculation Factors Helper ────────────────────────────────────────

  async getTrustFactorsInput(userId: string) {
    const [profile, verification, ratingAnalytics, memoryCount, guardianCount] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId },
        select: {
          socialAccounts: true,
          completedTrips: true,
        },
      }),
      prisma.verificationState.findUnique({
        where: { userId },
      }),
      this.getRatingAnalytics(userId),
      prisma.travelMemory.count({
        where: { userId },
      }),
      prisma.guardian.count({
        where: { userId },
      }),
    ]);

    const completedTripCount = profile?.completedTrips?.length || 0;
    const socialAccountCount = profile?.socialAccounts?.length || 0;

    return {
      isPhoneVerified: verification?.phoneStatus === VerificationStatus.verified,
      isGovernmentIdVerified: verification?.governmentIdStatus === VerificationStatus.verified,
      socialAccountCount,
      completedTripCount,
      averageRating: ratingAnalytics.totalRatings > 0 ? ratingAnalytics.averageRating : null,
      memoryCount,
      guardianCount,
    };
  }

  async updateUserTrustScoreAndVerifiedStatus(userId: string, trustScore: number, isPhoneVerified: boolean, isIdentityVerified: boolean) {
    return prisma.profile.update({
      where: { userId },
      data: {
        trustScore,
        isPhoneVerified,
        isIdentityVerified,
      },
    });
  }
}
