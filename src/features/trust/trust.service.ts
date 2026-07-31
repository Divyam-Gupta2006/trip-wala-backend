import { prisma } from '../../core/db';
import { VerificationStatus, TripStatus } from '@prisma/client';
import { TrustRepository } from './trust.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { ApiError } from '../../core/errors';
import { computeTrustScore } from './trust.utils';

const repo = new TrustRepository();
const notifService = new NotificationsService();

export class TrustService {
  // ─── Trust Score Engine ───────────────────────────────────────────────────────

  async getTrustScoreAndBreakdown(userId: string) {
    const factors = await repo.getTrustFactorsInput(userId);
    return computeTrustScore(factors);
  }

  async calculateAndSyncTrustScore(userId: string): Promise<number> {
    const breakdown = await this.getTrustScoreAndBreakdown(userId);
    const verification = await repo.findVerificationState(userId);

    const isPhoneVerified = verification?.phoneStatus === VerificationStatus.verified;
    const isIdentityVerified = verification?.governmentIdStatus === VerificationStatus.verified;

    await repo.updateUserTrustScoreAndVerifiedStatus(
      userId,
      breakdown.score,
      isPhoneVerified,
      isIdentityVerified
    );

    return breakdown.score;
  }

  // ─── Ratings ──────────────────────────────────────────────────────────────────

  async createRating(
    raterId: string,
    data: {
      tripId: string;
      rateeId: string;
      reliability: number;
      communication: number;
      respectfulness: number;
      socialCompatibility: number;
      funToTravelWith: number;
      planningContribution: number;
      review?: string | null;
    }
  ) {
    if (raterId === data.rateeId) {
      throw new ApiError(400, 'SELF_RATING_FORBIDDEN', 'You cannot rate yourself.');
    }

    // Verify trip exists and is completed
    const trip = await prisma.trip.findUnique({
      where: { id: data.tripId },
      include: {
        members: true,
      },
    });

    if (!trip || trip.isDeleted) {
      throw new ApiError(404, 'TRIP_NOT_FOUND', 'Trip not found.');
    }

    if (trip.status !== TripStatus.completed) {
      throw new ApiError(400, 'TRIP_NOT_COMPLETED', 'You can only rate participants of a completed trip.');
    }

    // Verify both rater and ratee were members of the trip
    const raterMember = trip.members.find((m) => m.userId === raterId);
    const rateeMember = trip.members.find((m) => m.userId === data.rateeId);

    if (!raterMember) {
      throw new ApiError(403, 'NOT_TRIP_MEMBER', 'You must have participated in this trip to rate.');
    }

    if (!rateeMember) {
      throw new ApiError(400, 'RATEE_NOT_TRIP_MEMBER', 'The recipient was not a participant in this trip.');
    }

    // Check duplicate rating
    const existing = await repo.findRatingByTripAndRaterAndRatee(data.tripId, raterId, data.rateeId);
    if (existing) {
      throw new ApiError(409, 'DUPLICATE_RATING', 'You have already rated this user for this trip.');
    }

    const rating = await repo.createRating({
      ...data,
      raterId,
    });

    // Sync trust score of ratee
    await this.calculateAndSyncTrustScore(data.rateeId);

    // Notify ratee
    notifService.publish({
      userId: data.rateeId,
      actorId: raterId,
      type: 'new_rating_received',
      title: 'New Rating Received',
      body: `${rating.rater.name} has rated you for the trip "${trip.title}".`,
      relatedEntityId: rating.id,
      relatedEntityType: 'rating',
      metadata: { ratingId: rating.id, tripId: data.tripId },
    }).catch(() => {});

    return rating;
  }

  async listRatingsForUser(rateeId: string, options: { limit: number; cursor?: string }) {
    return repo.findRatingsForUser(rateeId, options);
  }

  async getUserRatingAnalytics(userId: string) {
    return repo.getRatingAnalytics(userId);
  }

  // ─── Identity Verification ─────────────────────────────────────────────────────

  async getVerificationState(userId: string) {
    let state = await repo.findVerificationState(userId);
    if (!state) {
      state = await repo.upsertVerificationState(userId, {
        user: { connect: { id: userId } },
        phoneStatus: 'notStarted',
        governmentIdStatus: 'notStarted',
        socialStatus: 'notStarted',
      });
    }
    return state;
  }

  async requestVerification(userId: string, type: 'phone' | 'governmentId' | 'social') {
    const current = await this.getVerificationState(userId);

    const updateData: any = {};
    if (type === 'phone') {
      updateData.phoneStatus = 'pending';
      updateData.phoneRequestedAt = new Date();
    } else if (type === 'governmentId') {
      updateData.governmentIdStatus = 'pending';
      updateData.governmentIdRequestedAt = new Date();
    } else {
      updateData.socialStatus = 'pending';
      updateData.socialRequestedAt = new Date();
    }

    const updated = await repo.updateVerificationState(userId, updateData);

    // Dynamic trust score update
    await this.calculateAndSyncTrustScore(userId);

    return updated;
  }

  async updateVerificationStatus(
    userId: string,
    type: 'phone' | 'governmentId' | 'social',
    status: 'notStarted' | 'pending' | 'verified'
  ) {
    const updateData: any = {};
    if (type === 'phone') {
      updateData.phoneStatus = status;
      if (status === 'verified') updateData.phoneVerifiedAt = new Date();
    } else if (type === 'governmentId') {
      updateData.governmentIdStatus = status;
      if (status === 'verified') updateData.governmentIdVerifiedAt = new Date();
    } else {
      updateData.socialStatus = status;
      if (status === 'verified') updateData.socialVerifiedAt = new Date();
    }

    const updated = await repo.updateVerificationState(userId, updateData);

    // Sync trust score
    await this.calculateAndSyncTrustScore(userId);

    // Notify user of status update
    notifService.publish({
      userId,
      actorId: undefined,
      type: 'verification_status_updated',
      title: 'Verification Update',
      body: `Your ${type} verification status has been updated to ${status}.`,
      relatedEntityId: userId,
      relatedEntityType: 'user',
      metadata: { type, status },
    }).catch(() => {});

    return updated;
  }

  // ─── Guardians ────────────────────────────────────────────────────────────────

  async addGuardian(
    userId: string,
    data: {
      name: string;
      phone: string;
      relationship: string;
      email?: string | null;
      notes?: string | null;
      isPrimaryEmergencyContact?: boolean;
    }
  ) {
    const guardian = await repo.createGuardian(userId, data);

    // Recalculate trust score
    await this.calculateAndSyncTrustScore(userId);

    // Notify user
    notifService.publish({
      userId,
      actorId: undefined,
      type: 'guardian_added',
      title: 'Guardian Added',
      body: `${data.name} has been added as your trusted guardian.`,
      relatedEntityId: guardian.id,
      relatedEntityType: 'guardian',
      metadata: { guardianId: guardian.id },
    }).catch(() => {});

    return guardian;
  }

  async listGuardians(userId: string) {
    return repo.findGuardiansByUser(userId);
  }

  async updateGuardian(
    userId: string,
    guardianId: string,
    data: Partial<{
      name: string;
      phone: string;
      relationship: string;
      email: string | null;
      notes: string | null;
      isPrimaryEmergencyContact: boolean;
    }>
  ) {
    const guardian = await repo.findGuardianById(guardianId);
    if (!guardian) {
      throw new ApiError(404, 'GUARDIAN_NOT_FOUND', 'Guardian not found.');
    }
    if (guardian.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not own this guardian record.');
    }

    const updated = await repo.updateGuardian(guardianId, userId, data);

    // Recalculate trust score
    await this.calculateAndSyncTrustScore(userId);

    return updated;
  }

  async removeGuardian(userId: string, guardianId: string) {
    const guardian = await repo.findGuardianById(guardianId);
    if (!guardian) {
      throw new ApiError(404, 'GUARDIAN_NOT_FOUND', 'Guardian not found.');
    }
    if (guardian.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not own this guardian record.');
    }

    await repo.deleteGuardian(guardianId);

    // Recalculate trust score
    await this.calculateAndSyncTrustScore(userId);

    // Notify user
    notifService.publish({
      userId,
      actorId: undefined,
      type: 'guardian_removed',
      title: 'Guardian Removed',
      body: `${guardian.name} has been removed from your guardians.`,
      relatedEntityId: guardianId,
      relatedEntityType: 'guardian',
      metadata: { guardianId },
    }).catch(() => {});
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
    // If tripId is provided, verify user is/was member of the trip
    if (data.tripId) {
      const member = await prisma.tripMember.findUnique({
        where: { tripId_userId: { tripId: data.tripId, userId } },
      });
      if (!member) {
        throw new ApiError(403, 'NOT_TRIP_MEMBER', 'You can only link memories to trips you joined.');
      }
    }

    const memory = await repo.createMemory(userId, data);

    // Recalculate trust score
    await this.calculateAndSyncTrustScore(userId);

    return memory;
  }

  async listMemories(userId: string, viewerId: string, options: { limit: number; cursor?: string }) {
    return repo.findMemoriesByUser(userId, viewerId, options);
  }

  async updateMemory(
    userId: string,
    memoryId: string,
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
    const memory = await repo.findMemoryById(memoryId);
    if (!memory) {
      throw new ApiError(404, 'MEMORY_NOT_FOUND', 'Travel memory not found.');
    }
    if (memory.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not own this travel memory.');
    }

    // Verify trip membership if changing tripId
    if (data.tripId && data.tripId !== memory.tripId) {
      const member = await prisma.tripMember.findUnique({
        where: { tripId_userId: { tripId: data.tripId, userId } },
      });
      if (!member) {
        throw new ApiError(403, 'NOT_TRIP_MEMBER', 'You can only link memories to trips you joined.');
      }
    }

    return repo.updateMemory(memoryId, data);
  }

  async deleteMemory(userId: string, memoryId: string) {
    const memory = await repo.findMemoryById(memoryId);
    if (!memory) {
      throw new ApiError(404, 'MEMORY_NOT_FOUND', 'Travel memory not found.');
    }
    if (memory.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not own this travel memory.');
    }

    await repo.deleteMemory(memoryId);

    // Recalculate trust score
    await this.calculateAndSyncTrustScore(userId);
  }
}
export const trustService = new TrustService();
export default trustService;
