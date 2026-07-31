import { prisma } from '../../core/db';
import { ApplicationStatus, InvitationStatus, Role, Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient | typeof prisma;


export class MembershipsRepository {
  // --- Applications ---

  async createApplication(data: { tripId: string; userId: string; message?: string }, tx: TxClient = prisma) {
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

  async findApplicationById(id: string, tx: TxClient = prisma) {
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

  async findApplicationByTripAndUser(tripId: string, userId: string, tx: TxClient = prisma) {
    return tx.tripApplication.findUnique({
      where: {
        tripId_userId: { tripId, userId },
      },
    });
  }

  async updateApplicationStatus(id: string, status: ApplicationStatus, reviewNotes?: string, tx: TxClient = prisma) {
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

  async findApplicationsByTrip(tripId: string, status?: ApplicationStatus, tx: TxClient = prisma) {
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

  async findApplicationsByUser(userId: string, tx: TxClient = prisma) {
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

  async createInvitation(data: { tripId: string; inviterId: string; inviteeId: string; role?: Role }, tx: TxClient = prisma) {
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

  async findInvitationById(id: string, tx: TxClient = prisma) {
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

  async findInvitationByTripAndUser(tripId: string, inviteeId: string, tx: TxClient = prisma) {
    return tx.tripInvitation.findUnique({
      where: {
        tripId_inviteeId: { tripId, inviteeId },
      },
    });
  }

  async updateInvitationStatus(id: string, status: InvitationStatus, tx: TxClient = prisma) {
    return tx.tripInvitation.update({
      where: { id },
      data: { status },
      include: {
        trip: true,
        invitee: { include: { profile: true } },
      },
    });
  }

  async findInvitationsSent(inviterId: string, tx: TxClient = prisma) {
    return tx.tripInvitation.findMany({
      where: { inviterId },
      include: {
        trip: true,
        invitee: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findInvitationsReceived(inviteeId: string, tx: TxClient = prisma) {
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

  async findMember(tripId: string, userId: string, tx: TxClient = prisma) {
    return tx.tripMember.findUnique({
      where: {
        tripId_userId: { tripId, userId },
      },
    });
  }

  async addMember(tripId: string, userId: string, role: Role = 'member', tx: TxClient = prisma) {
    return tx.tripMember.create({
      data: { tripId, userId, role },
    });
  }

  async removeMember(tripId: string, userId: string, tx: TxClient = prisma) {
    return tx.tripMember.delete({
      where: {
        tripId_userId: { tripId, userId },
      },
    });
  }

  async updateMemberRole(tripId: string, userId: string, role: Role, tx: TxClient = prisma) {
    return tx.tripMember.update({
      where: {
        tripId_userId: { tripId, userId },
      },
      data: { role },
    });
  }
}
