"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trustService = exports.TrustService = void 0;
const db_1 = require("../../core/db");
const client_1 = require("@prisma/client");
const trust_repository_1 = require("./trust.repository");
const notifications_service_1 = require("../notifications/notifications.service");
const errors_1 = require("../../core/errors");
const trust_utils_1 = require("./trust.utils");
const repo = new trust_repository_1.TrustRepository();
const notifService = new notifications_service_1.NotificationsService();
class TrustService {
    // ─── Trust Score Engine ───────────────────────────────────────────────────────
    async getTrustScoreAndBreakdown(userId) {
        const factors = await repo.getTrustFactorsInput(userId);
        return (0, trust_utils_1.computeTrustScore)(factors);
    }
    async calculateAndSyncTrustScore(userId) {
        const breakdown = await this.getTrustScoreAndBreakdown(userId);
        const verification = await repo.findVerificationState(userId);
        const isPhoneVerified = verification?.phoneStatus === client_1.VerificationStatus.verified;
        const isIdentityVerified = verification?.governmentIdStatus === client_1.VerificationStatus.verified;
        await repo.updateUserTrustScoreAndVerifiedStatus(userId, breakdown.score, isPhoneVerified, isIdentityVerified);
        return breakdown.score;
    }
    // ─── Ratings ──────────────────────────────────────────────────────────────────
    async createRating(raterId, data) {
        if (raterId === data.rateeId) {
            throw new errors_1.ApiError(400, 'SELF_RATING_FORBIDDEN', 'You cannot rate yourself.');
        }
        // Verify trip exists and is completed
        const trip = await db_1.prisma.trip.findUnique({
            where: { id: data.tripId },
            include: {
                members: true,
            },
        });
        if (!trip || trip.isDeleted) {
            throw new errors_1.ApiError(404, 'TRIP_NOT_FOUND', 'Trip not found.');
        }
        if (trip.status !== client_1.TripStatus.completed) {
            throw new errors_1.ApiError(400, 'TRIP_NOT_COMPLETED', 'You can only rate participants of a completed trip.');
        }
        // Verify both rater and ratee were members of the trip
        const raterMember = trip.members.find((m) => m.userId === raterId);
        const rateeMember = trip.members.find((m) => m.userId === data.rateeId);
        if (!raterMember) {
            throw new errors_1.ApiError(403, 'NOT_TRIP_MEMBER', 'You must have participated in this trip to rate.');
        }
        if (!rateeMember) {
            throw new errors_1.ApiError(400, 'RATEE_NOT_TRIP_MEMBER', 'The recipient was not a participant in this trip.');
        }
        // Check duplicate rating
        const existing = await repo.findRatingByTripAndRaterAndRatee(data.tripId, raterId, data.rateeId);
        if (existing) {
            throw new errors_1.ApiError(409, 'DUPLICATE_RATING', 'You have already rated this user for this trip.');
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
        }).catch(() => { });
        return rating;
    }
    async listRatingsForUser(rateeId, options) {
        return repo.findRatingsForUser(rateeId, options);
    }
    async getUserRatingAnalytics(userId) {
        return repo.getRatingAnalytics(userId);
    }
    // ─── Identity Verification ─────────────────────────────────────────────────────
    async getVerificationState(userId) {
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
    async requestVerification(userId, type) {
        const current = await this.getVerificationState(userId);
        const updateData = {};
        if (type === 'phone') {
            updateData.phoneStatus = 'pending';
            updateData.phoneRequestedAt = new Date();
        }
        else if (type === 'governmentId') {
            updateData.governmentIdStatus = 'pending';
            updateData.governmentIdRequestedAt = new Date();
        }
        else {
            updateData.socialStatus = 'pending';
            updateData.socialRequestedAt = new Date();
        }
        const updated = await repo.updateVerificationState(userId, updateData);
        // Dynamic trust score update
        await this.calculateAndSyncTrustScore(userId);
        return updated;
    }
    async updateVerificationStatus(userId, type, status) {
        const updateData = {};
        if (type === 'phone') {
            updateData.phoneStatus = status;
            if (status === 'verified')
                updateData.phoneVerifiedAt = new Date();
        }
        else if (type === 'governmentId') {
            updateData.governmentIdStatus = status;
            if (status === 'verified')
                updateData.governmentIdVerifiedAt = new Date();
        }
        else {
            updateData.socialStatus = status;
            if (status === 'verified')
                updateData.socialVerifiedAt = new Date();
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
        }).catch(() => { });
        return updated;
    }
    // ─── Guardians ────────────────────────────────────────────────────────────────
    async addGuardian(userId, data) {
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
        }).catch(() => { });
        return guardian;
    }
    async listGuardians(userId) {
        return repo.findGuardiansByUser(userId);
    }
    async updateGuardian(userId, guardianId, data) {
        const guardian = await repo.findGuardianById(guardianId);
        if (!guardian) {
            throw new errors_1.ApiError(404, 'GUARDIAN_NOT_FOUND', 'Guardian not found.');
        }
        if (guardian.userId !== userId) {
            throw new errors_1.ApiError(403, 'FORBIDDEN', 'You do not own this guardian record.');
        }
        const updated = await repo.updateGuardian(guardianId, userId, data);
        // Recalculate trust score
        await this.calculateAndSyncTrustScore(userId);
        return updated;
    }
    async removeGuardian(userId, guardianId) {
        const guardian = await repo.findGuardianById(guardianId);
        if (!guardian) {
            throw new errors_1.ApiError(404, 'GUARDIAN_NOT_FOUND', 'Guardian not found.');
        }
        if (guardian.userId !== userId) {
            throw new errors_1.ApiError(403, 'FORBIDDEN', 'You do not own this guardian record.');
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
        }).catch(() => { });
    }
    // ─── Travel Memories ─────────────────────────────────────────────────────────
    async createMemory(userId, data) {
        // If tripId is provided, verify user is/was member of the trip
        if (data.tripId) {
            const member = await db_1.prisma.tripMember.findUnique({
                where: { tripId_userId: { tripId: data.tripId, userId } },
            });
            if (!member) {
                throw new errors_1.ApiError(403, 'NOT_TRIP_MEMBER', 'You can only link memories to trips you joined.');
            }
        }
        const memory = await repo.createMemory(userId, data);
        // Recalculate trust score
        await this.calculateAndSyncTrustScore(userId);
        return memory;
    }
    async listMemories(userId, viewerId, options) {
        return repo.findMemoriesByUser(userId, viewerId, options);
    }
    async updateMemory(userId, memoryId, data) {
        const memory = await repo.findMemoryById(memoryId);
        if (!memory) {
            throw new errors_1.ApiError(404, 'MEMORY_NOT_FOUND', 'Travel memory not found.');
        }
        if (memory.userId !== userId) {
            throw new errors_1.ApiError(403, 'FORBIDDEN', 'You do not own this travel memory.');
        }
        // Verify trip membership if changing tripId
        if (data.tripId && data.tripId !== memory.tripId) {
            const member = await db_1.prisma.tripMember.findUnique({
                where: { tripId_userId: { tripId: data.tripId, userId } },
            });
            if (!member) {
                throw new errors_1.ApiError(403, 'NOT_TRIP_MEMBER', 'You can only link memories to trips you joined.');
            }
        }
        return repo.updateMemory(memoryId, data);
    }
    async deleteMemory(userId, memoryId) {
        const memory = await repo.findMemoryById(memoryId);
        if (!memory) {
            throw new errors_1.ApiError(404, 'MEMORY_NOT_FOUND', 'Travel memory not found.');
        }
        if (memory.userId !== userId) {
            throw new errors_1.ApiError(403, 'FORBIDDEN', 'You do not own this travel memory.');
        }
        await repo.deleteMemory(memoryId);
        // Recalculate trust score
        await this.calculateAndSyncTrustScore(userId);
    }
}
exports.TrustService = TrustService;
exports.trustService = new TrustService();
exports.default = exports.trustService;
