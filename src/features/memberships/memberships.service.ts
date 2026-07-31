import { MembershipsRepository } from './memberships.repository';
import { ApiError } from '../../core/errors';
import { prisma } from '../../core/db';
import { ApplicationStatus, InvitationStatus, Role } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

const notifService = new NotificationsService();

export class MembershipsService {
  private repo = new MembershipsRepository();

  // --- Applications Business Logic ---

  async applyToTrip(tripId: string, userId: string, message?: string) {
    // 1. Fetch trip and check constraints
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { members: true },
    });

    if (!trip || trip.isDeleted) {
      throw new ApiError(404, 'TRIP_NOT_FOUND', 'The trip you are applying to does not exist.');
    }

    if (trip.status === 'cancelled' || trip.status === 'completed') {
      throw new ApiError(400, 'INVALID_TRIP_STATE', 'Cannot apply to a cancelled or completed trip.');
    }

    // 2. Check if already a member
    const isMember = trip.members.some((m) => m.userId === userId);
    if (isMember) {
      throw new ApiError(400, 'ALREADY_MEMBER', 'You are already a member of this trip.');
    }

    // 3. Check for existing active application (pending or accepted)
    const existing = await this.repo.findApplicationByTripAndUser(tripId, userId);
    if (existing && (existing.status === 'pending' || existing.status === 'accepted')) {
      throw new ApiError(400, 'DUPLICATE_APPLICATION', 'You have already applied to this trip.');
    }

    // 4. Check capacity
    if (trip.members.length >= trip.maxMembers) {
      throw new ApiError(400, 'TRIP_FULL', 'This trip is already full.');
    }

    const application = await this.repo.createApplication({ tripId, userId, message });

    // Notify all trip organizers of new application
    const organizers = trip.members.filter((m) => m.role === 'organizer' || m.role === 'coOrganizer');
    await Promise.all(
      organizers.map((org) =>
        notifService.publish({
          userId: org.userId,
          actorId: userId,
          type: 'application_submitted',
          title: 'New Trip Application',
          body: `A new member has applied to join "${trip.title}".`,
          relatedEntityId: tripId,
          relatedEntityType: 'trip',
          metadata: { applicationId: application.id, tripId },
        })
      )
    );

    return application;
  }

  async cancelApplication(applicationId: string, userId: string) {
    const app = await this.repo.findApplicationById(applicationId);
    if (!app) {
      throw new ApiError(404, 'APPLICATION_NOT_FOUND', 'Application not found.');
    }

    if (app.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN_APPLICATION_ACCESS', 'You can only cancel your own application.');
    }

    if (app.status !== 'pending') {
      throw new ApiError(400, 'INVALID_STATE_TRANSITION', 'Can only cancel pending applications.');
    }

    return this.repo.updateApplicationStatus(applicationId, 'cancelled');
  }

  async acceptApplication(applicationId: string, organizerId: string, reviewNotes?: string) {
    const app = await this.repo.findApplicationById(applicationId);
    if (!app) {
      throw new ApiError(404, 'APPLICATION_NOT_FOUND', 'Application not found.');
    }

    // Validate organizer permissions
    const organizerMember = app.trip.members.find((m) => m.userId === organizerId);
    if (!organizerMember || (organizerMember.role !== 'organizer' && organizerMember.role !== 'coOrganizer')) {
      throw new ApiError(403, 'FORBIDDEN_TRIP_ACCESS', 'Only trip organizers can review applications.');
    }

    if (app.status !== 'pending') {
      throw new ApiError(400, 'INVALID_STATE_TRANSITION', 'Can only accept pending applications.');
    }

    // Check capacity
    if (app.trip.members.length >= app.trip.maxMembers) {
      throw new ApiError(400, 'TRIP_FULL', 'Trip capacity has already been reached.');
    }

    // Check if already member
    const isAlreadyMember = app.trip.members.some((m) => m.userId === app.userId);

    return prisma.$transaction(async (tx) => {
      // 1. Update application status
      const updatedApp = await this.repo.updateApplicationStatus(applicationId, 'accepted', reviewNotes, tx);

      // 2. Add member if not already there
      if (!isAlreadyMember) {
        await this.repo.addMember(app.tripId, app.userId, 'member', tx);
        await tx.conversationParticipant.upsert({
          where: { conversationId_userId: { conversationId: app.tripId, userId: app.userId } },
          create: { conversationId: app.tripId, userId: app.userId },
          update: {},
        });
      }

      // 3. Update trip status if capacity now reached
      const currentMemberCount = app.trip.members.length + (isAlreadyMember ? 0 : 1);
      if (currentMemberCount >= app.trip.maxMembers) {
        await tx.trip.update({
          where: { id: app.tripId },
          data: { status: 'full' },
        });
      }

      // Notify applicant of acceptance
      notifService.publish({
        userId: app.userId,
        actorId: organizerId,
        type: 'application_accepted',
        title: 'Application Accepted!',
        body: `Your application to join "${app.trip.title}" has been accepted.`,
        relatedEntityId: app.tripId,
        relatedEntityType: 'trip',
        metadata: { applicationId, tripId: app.tripId },
      }).catch(() => {}); // fire-and-forget

      return updatedApp;
    });
  }

  async rejectApplication(applicationId: string, organizerId: string, reviewNotes?: string) {
    const app = await this.repo.findApplicationById(applicationId);
    if (!app) {
      throw new ApiError(404, 'APPLICATION_NOT_FOUND', 'Application not found.');
    }

    // Validate organizer permissions
    const organizerMember = app.trip.members.find((m) => m.userId === organizerId);
    if (!organizerMember || (organizerMember.role !== 'organizer' && organizerMember.role !== 'coOrganizer')) {
      throw new ApiError(403, 'FORBIDDEN_TRIP_ACCESS', 'Only trip organizers can review applications.');
    }

    if (app.status !== 'pending') {
      throw new ApiError(400, 'INVALID_STATE_TRANSITION', 'Can only reject pending applications.');
    }

    const rejected = await this.repo.updateApplicationStatus(applicationId, 'rejected', reviewNotes);

    // Notify applicant of rejection
    notifService.publish({
      userId: app.userId,
      actorId: organizerId,
      type: 'application_rejected',
      title: 'Application Update',
      body: `Your application to join "${app.trip.title}" was not accepted at this time.`,
      relatedEntityId: app.tripId,
      relatedEntityType: 'trip',
      metadata: { applicationId, tripId: app.tripId },
    }).catch(() => {});

    return rejected;
  }

  // --- Invitations Business Logic ---

  async inviteUser(tripId: string, inviterId: string, inviteeId: string, role: Role = 'member') {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { members: true },
    });

    if (!trip || trip.isDeleted) {
      throw new ApiError(404, 'TRIP_NOT_FOUND', 'The requested trip does not exist.');
    }

    // Check organizer permissions
    const inviterMember = trip.members.find((m) => m.userId === inviterId);
    if (!inviterMember || (inviterMember.role !== 'organizer' && inviterMember.role !== 'coOrganizer')) {
      throw new ApiError(403, 'FORBIDDEN_TRIP_ACCESS', 'Only organizers can invite members to this trip.');
    }

    // Check if invitee is already a member
    const isMember = trip.members.some((m) => m.userId === inviteeId);
    if (isMember) {
      throw new ApiError(400, 'ALREADY_MEMBER', 'User is already a member of this trip.');
    }

    // Check for existing pending invitation
    const existing = await this.repo.findInvitationByTripAndUser(tripId, inviteeId);
    if (existing && existing.status === 'pending') {
      throw new ApiError(400, 'DUPLICATE_INVITATION', 'User has already been invited to this trip.');
    }

    // Check capacity
    if (trip.members.length >= trip.maxMembers) {
      throw new ApiError(400, 'TRIP_FULL', 'Cannot send invitation as the trip is already full.');
    }

    const invitation = await this.repo.createInvitation({ tripId, inviterId, inviteeId, role });

    // Notify the invitee
    notifService.publish({
      userId: inviteeId,
      actorId: inviterId,
      type: 'invitation_received',
      title: 'Trip Invitation',
      body: `You have been invited to join "${trip.title}".`,
      relatedEntityId: tripId,
      relatedEntityType: 'trip',
      metadata: { invitationId: invitation.id, tripId },
    }).catch(() => {});

    return invitation;
  }

  async cancelInvitation(invitationId: string, organizerId: string) {
    const invitation = await this.repo.findInvitationById(invitationId);
    if (!invitation) {
      throw new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation not found.');
    }

    const organizerMember = invitation.trip.members.find((m) => m.userId === organizerId);
    if (!organizerMember || (organizerMember.role !== 'organizer' && organizerMember.role !== 'coOrganizer')) {
      throw new ApiError(403, 'FORBIDDEN_TRIP_ACCESS', 'Only organizers can cancel invitations.');
    }

    if (invitation.status !== 'pending') {
      throw new ApiError(400, 'INVALID_STATE_TRANSITION', 'Can only cancel pending invitations.');
    }

    return this.repo.updateInvitationStatus(invitationId, 'cancelled');
  }

  async acceptInvitation(invitationId: string, inviteeId: string) {
    const invitation = await this.repo.findInvitationById(invitationId);
    if (!invitation) {
      throw new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation not found.');
    }

    if (invitation.inviteeId !== inviteeId) {
      throw new ApiError(403, 'FORBIDDEN_INVITATION_ACCESS', 'You can only respond to invitations sent to you.');
    }

    if (invitation.status !== 'pending') {
      throw new ApiError(400, 'INVALID_STATE_TRANSITION', 'Can only accept pending invitations.');
    }

    // Check capacity
    if (invitation.trip.members.length >= invitation.trip.maxMembers) {
      throw new ApiError(400, 'TRIP_FULL', 'Cannot accept invitation as the trip is full.');
    }

    // Check if already a member
    const isMember = invitation.trip.members.some((m) => m.userId === inviteeId);

    return prisma.$transaction(async (tx) => {
      // 1. Update invitation status
      const updatedInv = await this.repo.updateInvitationStatus(invitationId, 'accepted', tx);

      // 2. Add as trip member
      if (!isMember) {
        await this.repo.addMember(invitation.tripId, inviteeId, invitation.role, tx);
        await tx.conversationParticipant.upsert({
          where: { conversationId_userId: { conversationId: invitation.tripId, userId: inviteeId } },
          create: { conversationId: invitation.tripId, userId: inviteeId },
          update: {},
        });
      }

      // 3. Update trip status if capacity now reached
      const currentMemberCount = invitation.trip.members.length + (isMember ? 0 : 1);
      if (currentMemberCount >= invitation.trip.maxMembers) {
        await tx.trip.update({
          where: { id: invitation.tripId },
          data: { status: 'full' },
        });
      }

      // Notify inviter of acceptance
      notifService.publish({
        userId: invitation.inviterId,
        actorId: inviteeId,
        type: 'invitation_accepted',
        title: 'Invitation Accepted',
        body: `Your invitation to "${invitation.trip.title}" has been accepted.`,
        relatedEntityId: invitation.tripId,
        relatedEntityType: 'trip',
        metadata: { invitationId, tripId: invitation.tripId },
      }).catch(() => {});

      return updatedInv;
    });
  }

  async declineInvitation(invitationId: string, inviteeId: string) {
    const invitation = await this.repo.findInvitationById(invitationId);
    if (!invitation) {
      throw new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation not found.');
    }

    if (invitation.inviteeId !== inviteeId) {
      throw new ApiError(403, 'FORBIDDEN_INVITATION_ACCESS', 'You can only respond to invitations sent to you.');
    }

    if (invitation.status !== 'pending') {
      throw new ApiError(400, 'INVALID_STATE_TRANSITION', 'Can only decline pending invitations.');
    }

    const declined = await this.repo.updateInvitationStatus(invitationId, 'declined');

    // Notify inviter of decline
    notifService.publish({
      userId: invitation.inviterId,
      actorId: inviteeId,
      type: 'invitation_declined',
      title: 'Invitation Declined',
      body: `Your invitation to "${invitation.trip.title}" was declined.`,
      relatedEntityId: invitation.tripId,
      relatedEntityType: 'trip',
      metadata: { invitationId, tripId: invitation.tripId },
    }).catch(() => {});

    return declined;
  }

  // --- Memberships Direct Management Business Logic ---

  async addMemberDirectly(tripId: string, organizerId: string, userId: string, role: Role = 'member') {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { members: true },
    });

    if (!trip || trip.isDeleted) {
      throw new ApiError(404, 'TRIP_NOT_FOUND', 'The trip does not exist.');
    }

    // Verify organizer rights
    const orgMember = trip.members.find((m) => m.userId === organizerId);
    if (!orgMember || (orgMember.role !== 'organizer' && orgMember.role !== 'coOrganizer')) {
      throw new ApiError(403, 'FORBIDDEN_TRIP_ACCESS', 'Only organizers can add members directly.');
    }

    // Verify target user is not already member
    const isMember = trip.members.some((m) => m.userId === userId);
    if (isMember) {
      throw new ApiError(400, 'ALREADY_MEMBER', 'User is already a member of this trip.');
    }

    // Capacity check
    if (trip.members.length >= trip.maxMembers) {
      throw new ApiError(400, 'TRIP_FULL', 'Trip capacity has been reached.');
    }

    return prisma.$transaction(async (tx) => {
      const newMember = await this.repo.addMember(tripId, userId, role, tx);
      await tx.conversationParticipant.upsert({
        where: { conversationId_userId: { conversationId: tripId, userId } },
        create: { conversationId: tripId, userId },
        update: {},
      });

      const currentCount = trip.members.length + 1;
      if (currentCount >= trip.maxMembers) {
        await tx.trip.update({
          where: { id: tripId },
          data: { status: 'full' },
        });
      }

      return newMember;
    });
  }

  async removeMember(tripId: string, organizerId: string, userId: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { members: true },
    });

    if (!trip || trip.isDeleted) {
      throw new ApiError(404, 'TRIP_NOT_FOUND', 'The requested trip does not exist.');
    }

    // Check organizer permissions
    const orgMember = trip.members.find((m) => m.userId === organizerId);
    if (!orgMember || (orgMember.role !== 'organizer' && orgMember.role !== 'coOrganizer')) {
      throw new ApiError(403, 'FORBIDDEN_TRIP_ACCESS', 'Only organizers can remove members.');
    }

    // Verify user is in trip
    const memberToRemove = trip.members.find((m) => m.userId === userId);
    if (!memberToRemove) {
      throw new ApiError(404, 'MEMBER_NOT_FOUND', 'User is not a member of this trip.');
    }

    // Cannot remove sole organizer
    if (memberToRemove.role === 'organizer') {
      const otherOrganizers = trip.members.filter((m) => m.role === 'organizer' && m.userId !== userId);
      if (otherOrganizers.length === 0) {
        throw new ApiError(400, 'SOLE_ORGANIZER_REMOVE_ERROR', 'Cannot remove the sole organizer of a trip.');
      }
    }

    return prisma.$transaction(async (tx) => {
      const removed = await this.repo.removeMember(tripId, userId, tx);
      await tx.conversationParticipant.deleteMany({
        where: { conversationId: tripId, userId },
      });

      // Revert status to open if it was full
      if (trip.status === 'full') {
        await tx.trip.update({
          where: { id: tripId },
          data: { status: 'open' },
        });
      }

      // Notify removed member
      notifService.publish({
        userId,
        actorId: organizerId,
        type: 'trip_member_left',
        title: 'Removed from Trip',
        body: `You have been removed from the trip "${trip.title}".`,
        relatedEntityId: tripId,
        relatedEntityType: 'trip',
        metadata: { tripId },
      }).catch(() => {});

      return removed;
    });
  }

  async leaveTrip(tripId: string, userId: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { members: true },
    });

    if (!trip || trip.isDeleted) {
      throw new ApiError(404, 'TRIP_NOT_FOUND', 'The requested trip does not exist.');
    }

    const member = trip.members.find((m) => m.userId === userId);
    if (!member) {
      throw new ApiError(404, 'MEMBER_NOT_FOUND', 'You are not a member of this trip.');
    }

    // Sole organizer cannot leave
    if (member.role === 'organizer') {
      const otherOrganizers = trip.members.filter((m) => m.role === 'organizer' && m.userId !== userId);
      if (otherOrganizers.length === 0) {
        throw new ApiError(400, 'SOLE_ORGANIZER_LEAVE_ERROR', 'The sole organizer cannot leave the trip before transferring ownership.');
      }
    }

    return prisma.$transaction(async (tx) => {
      const left = await this.repo.removeMember(tripId, userId, tx);
      await tx.conversationParticipant.deleteMany({
        where: { conversationId: tripId, userId },
      });

      if (trip.status === 'full') {
        await tx.trip.update({
          where: { id: tripId },
          data: { status: 'open' },
        });
      }

      return left;
    });
  }

  async promoteMember(tripId: string, organizerId: string, userId: string, role: Role) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { members: true },
    });

    if (!trip || trip.isDeleted) {
      throw new ApiError(404, 'TRIP_NOT_FOUND', 'The requested trip does not exist.');
    }

    const orgMember = trip.members.find((m) => m.userId === organizerId);
    if (!orgMember || orgMember.role !== 'organizer') {
      throw new ApiError(403, 'FORBIDDEN_TRIP_ACCESS', 'Only the primary organizer can promote members or transfer ownership.');
    }

    const targetMember = trip.members.find((m) => m.userId === userId);
    if (!targetMember) {
      throw new ApiError(404, 'MEMBER_NOT_FOUND', 'Target user is not a member of this trip.');
    }

    // Role-specific promotions
    return prisma.$transaction(async (tx) => {
      if (role === 'organizer') {
        // Ownership Transfer: promote target to organizer, demote current inviter to coOrganizer
        await this.repo.updateMemberRole(tripId, userId, 'organizer', tx);
        await this.repo.updateMemberRole(tripId, organizerId, 'coOrganizer', tx);
      } else {
        // coOrganizer or member update
        await this.repo.updateMemberRole(tripId, userId, role, tx);
      }

      return tx.tripMember.findUnique({
        where: { tripId_userId: { tripId, userId } },
      });
    });
  }
}
