"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustRepository = void 0;
const db_1 = require("../../core/db");
const client_1 = require("@prisma/client");
class TrustRepository {
    // ─── Ratings ────────────────────────────────────────────────────────────────
    async createRating(data, tx = db_1.prisma) {
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
    async findRatingById(id, tx = db_1.prisma) {
        return tx.rating.findUnique({
            where: { id },
        });
    }
    async findRatingByTripAndRaterAndRatee(tripId, raterId, rateeId, tx = db_1.prisma) {
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
    async findRatingsForUser(rateeId, options) {
        const queryOptions = {
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
        const items = await db_1.prisma.rating.findMany(queryOptions);
        let nextCursor;
        if (items.length > options.limit) {
            nextCursor = items.pop().id;
        }
        return { items, nextCursor };
    }
    async getRatingAnalytics(rateeId) {
        const ratings = await db_1.prisma.rating.findMany({
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
            const rounded = Math.round(avg);
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
    async findVerificationState(userId) {
        return db_1.prisma.verificationState.findUnique({
            where: { userId },
        });
    }
    async upsertVerificationState(userId, data, tx = db_1.prisma) {
        return tx.verificationState.upsert({
            where: { userId },
            create: data,
            update: data,
        });
    }
    async updateVerificationState(userId, data, tx = db_1.prisma) {
        return tx.verificationState.update({
            where: { userId },
            data,
        });
    }
    // ─── Guardians ────────────────────────────────────────────────────────────────
    async createGuardian(userId, data, tx = db_1.prisma) {
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
    async findGuardianById(id) {
        return db_1.prisma.guardian.findUnique({
            where: { id },
        });
    }
    async findGuardiansByUser(userId) {
        return db_1.prisma.guardian.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async updateGuardian(id, userId, data, tx = db_1.prisma) {
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
    async deleteGuardian(id) {
        return db_1.prisma.guardian.delete({
            where: { id },
        });
    }
    // ─── Travel Memories ─────────────────────────────────────────────────────────
    async createMemory(userId, data) {
        return db_1.prisma.travelMemory.create({
            data: {
                userId,
                ...data,
            },
        });
    }
    async findMemoryById(id) {
        return db_1.prisma.travelMemory.findUnique({
            where: { id },
        });
    }
    async findMemoriesByUser(userId, viewerId, options) {
        // Determine visibility levels allowed
        // If viewer is self, they see all (public, friends, private)
        // If they are not self, they see public/friends (for simplicity we'll show public only to non-self, or we can check friendship status in future. Currently there is no Friend model, so non-self viewer sees 'public' only).
        const isSelf = userId === viewerId;
        const allowedVisibilities = isSelf ? ['public', 'friends', 'private'] : ['public'];
        const queryOptions = {
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
        const items = await db_1.prisma.travelMemory.findMany(queryOptions);
        let nextCursor;
        if (items.length > options.limit) {
            nextCursor = items.pop().id;
        }
        return { items, nextCursor };
    }
    async updateMemory(id, data) {
        return db_1.prisma.travelMemory.update({
            where: { id },
            data,
        });
    }
    async deleteMemory(id) {
        return db_1.prisma.travelMemory.delete({
            where: { id },
        });
    }
    // ─── Trust Calculation Factors Helper ────────────────────────────────────────
    async getTrustFactorsInput(userId) {
        const [profile, verification, ratingAnalytics, memoryCount, guardianCount] = await Promise.all([
            db_1.prisma.profile.findUnique({
                where: { userId },
                select: {
                    socialAccounts: true,
                    completedTrips: true,
                },
            }),
            db_1.prisma.verificationState.findUnique({
                where: { userId },
            }),
            this.getRatingAnalytics(userId),
            db_1.prisma.travelMemory.count({
                where: { userId },
            }),
            db_1.prisma.guardian.count({
                where: { userId },
            }),
        ]);
        const completedTripCount = profile?.completedTrips?.length || 0;
        const socialAccountCount = profile?.socialAccounts?.length || 0;
        return {
            isPhoneVerified: verification?.phoneStatus === client_1.VerificationStatus.verified,
            isGovernmentIdVerified: verification?.governmentIdStatus === client_1.VerificationStatus.verified,
            socialAccountCount,
            completedTripCount,
            averageRating: ratingAnalytics.totalRatings > 0 ? ratingAnalytics.averageRating : null,
            memoryCount,
            guardianCount,
        };
    }
    async updateUserTrustScoreAndVerifiedStatus(userId, trustScore, isPhoneVerified, isIdentityVerified) {
        return db_1.prisma.profile.update({
            where: { userId },
            data: {
                trustScore,
                isPhoneVerified,
                isIdentityVerified,
            },
        });
    }
}
exports.TrustRepository = TrustRepository;
