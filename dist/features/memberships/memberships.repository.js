"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembershipsRepository = void 0;
const db_1 = require("../../core/db");
class MembershipsRepository {
    // --- Applications ---
    async createApplication(data, tx = db_1.prisma) {
        return tx.tripApplication.create({
            data: {
                tripId: data.tripId,
                userId: data.userId,
                message: data.message,
                status: 'pending',
            },
            include: {
                user: {
                    include: {
                        profile: true,
                    },
                },
            },
        });
    }
    async findApplicationById(id, tx = db_1.prisma) {
        return tx.tripApplication.findUnique({
            where: { id },
            include: {
                trip: {
                    include: {
                        members: true,
                    },
                },
                user: {
                    include: {
                        profile: true,
                    },
                },
            },
        });
    }
    async findApplicationByTripAndUser(tripId, userId, tx = db_1.prisma) {
        return tx.tripApplication.findUnique({
            where: {
                tripId_userId: { tripId, userId },
            },
        });
    }
    async updateApplicationStatus(id, status, reviewNotes, tx = db_1.prisma) {
        return tx.tripApplication.update({
            where: { id },
            data: {
                status,
                reviewNotes,
            },
            include: {
                user: {
                    include: {
                        profile: true,
                    },
                },
            },
        });
    }
    async findApplicationsByTrip(tripId, status, tx = db_1.prisma) {
        return tx.tripApplication.findMany({
            where: {
                tripId,
                ...(status ? { status } : {}),
            },
            include: {
                user: {
                    include: {
                        profile: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findApplicationsByUser(userId, tx = db_1.prisma) {
        return tx.tripApplication.findMany({
            where: { userId },
            include: {
                trip: {
                    include: {
                        members: {
                            include: {
                                user: {
                                    include: {
                                        profile: true,
                                    },
                                },
                            },
                        },
                    },
                },
                user: {
                    include: {
                        profile: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    // --- Invitations ---
    async createInvitation(data, tx = db_1.prisma) {
        return tx.tripInvitation.create({
            data: {
                tripId: data.tripId,
                inviterId: data.inviterId,
                inviteeId: data.inviteeId,
                role: data.role || 'member',
                status: 'pending',
            },
            include: {
                trip: true,
                inviter: { include: { profile: true } },
                invitee: { include: { profile: true } },
            },
        });
    }
    async findInvitationById(id, tx = db_1.prisma) {
        return tx.tripInvitation.findUnique({
            where: { id },
            include: {
                trip: {
                    include: {
                        members: true,
                    },
                },
                inviter: { include: { profile: true } },
                invitee: { include: { profile: true } },
            },
        });
    }
    async findInvitationByTripAndUser(tripId, inviteeId, tx = db_1.prisma) {
        return tx.tripInvitation.findUnique({
            where: {
                tripId_inviteeId: { tripId, inviteeId },
            },
        });
    }
    async updateInvitationStatus(id, status, tx = db_1.prisma) {
        return tx.tripInvitation.update({
            where: { id },
            data: { status },
            include: {
                trip: true,
                invitee: { include: { profile: true } },
            },
        });
    }
    async findInvitationsSent(inviterId, tx = db_1.prisma) {
        return tx.tripInvitation.findMany({
            where: { inviterId },
            include: {
                trip: true,
                invitee: { include: { profile: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findInvitationsReceived(inviteeId, tx = db_1.prisma) {
        return tx.tripInvitation.findMany({
            where: { inviteeId },
            include: {
                trip: true,
                inviter: { include: { profile: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    // --- Members ---
    async findMember(tripId, userId, tx = db_1.prisma) {
        return tx.tripMember.findUnique({
            where: {
                tripId_userId: { tripId, userId },
            },
        });
    }
    async addMember(tripId, userId, role = 'member', tx = db_1.prisma) {
        return tx.tripMember.create({
            data: { tripId, userId, role },
        });
    }
    async removeMember(tripId, userId, tx = db_1.prisma) {
        return tx.tripMember.delete({
            where: {
                tripId_userId: { tripId, userId },
            },
        });
    }
    async updateMemberRole(tripId, userId, role, tx = db_1.prisma) {
        return tx.tripMember.update({
            where: {
                tripId_userId: { tripId, userId },
            },
            data: { role },
        });
    }
}
exports.MembershipsRepository = MembershipsRepository;
