import { Request, Response, NextFunction } from 'express';
import { MembershipsService } from './memberships.service';
import { MembershipsRepository } from './memberships.repository';
import { ApiError } from '../../core/errors';
import { prisma } from '../../core/db';

const service = new MembershipsService();
const repo = new MembershipsRepository();

// Format Application to match Flutter client ApplicationModel
export function formatApplicationResponse(app: any) {
  return {
    id: app.id,
    tripId: app.tripId,
    userId: app.userId,
    userName: app.user.name,
    userAvatarUrl: app.user.profile?.avatarUrl || null,
    userTrustScore: app.user.profile?.trustScore ?? 30,
    userIsIdentityVerified: app.user.profile?.isIdentityVerified ?? false,
    message: app.message || '',
    reviewNotes: app.reviewNotes || null,
    appliedAt: app.createdAt.toISOString(),
    status: app.status,
  };
}

// Format Invitation to match Flutter client InvitationModel
export function formatInvitationResponse(inv: any) {
  return {
    id: inv.id,
    tripId: inv.tripId,
    tripTitle: inv.trip.title,
    tripImageUrl: inv.trip.imageUrl || '',
    inviterId: inv.inviterId,
    inviterName: inv.inviter?.name || '',
    inviteeId: inv.inviteeId,
    invitedAt: inv.createdAt.toISOString(),
    status: inv.status === 'declined' ? 'rejected' : inv.status, // Map 'declined' to 'rejected' for the Flutter client
  };
}

// --- Application Handlers ---

export async function applyToTrip(req: Request, res: Response, next: NextFunction) {
  try {
    const { tripId } = req.params;
    const userId = req.user!.id;
    const { coverLetter, message } = req.body;

    // Support both 'coverLetter' (API_CONTRACTS.md reference) and 'message'
    const finalMessage = message || coverLetter || '';

    const app = await service.applyToTrip(tripId, userId, finalMessage);

    return res.status(200).json({
      success: true,
      message: 'Application submitted successfully',
      data: formatApplicationResponse(app),
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const cancelled = await service.cancelApplication(id, userId);

    return res.status(200).json({
      success: true,
      message: 'Application cancelled successfully',
      data: formatApplicationResponse(cancelled),
    });
  } catch (error) {
    next(error);
  }
}

export async function acceptApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const organizerId = req.user!.id;
    const { reviewNotes } = req.body;

    const app = await service.acceptApplication(id, organizerId, reviewNotes);

    return res.status(200).json({
      success: true,
      message: 'Application accepted successfully',
      data: formatApplicationResponse(app),
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const organizerId = req.user!.id;
    const { reviewNotes } = req.body;

    const app = await service.rejectApplication(id, organizerId, reviewNotes);

    return res.status(200).json({
      success: true,
      message: 'Application rejected successfully',
      data: formatApplicationResponse(app),
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyApplications(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const apps = await repo.findApplicationsByUser(userId);

    return res.status(200).json({
      success: true,
      message: 'My applications retrieved successfully',
      data: apps.map(formatApplicationResponse),
    });
  } catch (error) {
    next(error);
  }
}

export async function getTripApplications(req: Request, res: Response, next: NextFunction) {
  try {
    const { tripId } = req.params;
    const currentUserId = req.user!.id;

    // Verify user is trip organizer
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { members: true },
    });

    if (!trip || trip.isDeleted) {
      throw new ApiError(404, 'TRIP_NOT_FOUND', 'Trip not found.');
    }

    const orgMember = trip.members.find((m) => m.userId === currentUserId);
    if (!orgMember || (orgMember.role !== 'organizer' && orgMember.role !== 'coOrganizer')) {
      throw new ApiError(403, 'FORBIDDEN_TRIP_ACCESS', 'Only trip organizers can view applications.');
    }

    const status = req.query.status as any;
    const apps = await repo.findApplicationsByTrip(tripId, status);

    return res.status(200).json({
      success: true,
      message: 'Trip applications retrieved successfully',
      data: apps.map(formatApplicationResponse),
    });
  } catch (error) {
    next(error);
  }
}

export async function getApplicationDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const app = await repo.findApplicationById(id);
    if (!app) {
      throw new ApiError(404, 'APPLICATION_NOT_FOUND', 'Application not found.');
    }

    // Permission check: applicant or trip organizer
    const isApplicant = app.userId === currentUserId;
    const isOrganizer = app.trip.members.some(
      (m) => m.userId === currentUserId && (m.role === 'organizer' || m.role === 'coOrganizer')
    );

    if (!isApplicant && !isOrganizer) {
      throw new ApiError(403, 'FORBIDDEN_APPLICATION_ACCESS', 'You do not have access to view this application.');
    }

    return res.status(200).json({
      success: true,
      message: 'Application details retrieved successfully',
      data: formatApplicationResponse(app),
    });
  } catch (error) {
    next(error);
  }
}

// --- Invitation Handlers ---

export async function inviteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { tripId } = req.params;
    const inviterId = req.user!.id;
    const { inviteeId, role } = req.body;

    const invitation = await service.inviteUser(tripId, inviterId, inviteeId, role);

    return res.status(201).json({
      success: true,
      message: 'User invited successfully',
      data: formatInvitationResponse(invitation),
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const organizerId = req.user!.id;

    const cancelled = await service.cancelInvitation(id, organizerId);

    return res.status(200).json({
      success: true,
      message: 'Invitation cancelled successfully',
      data: formatInvitationResponse(cancelled),
    });
  } catch (error) {
    next(error);
  }
}

export async function acceptInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const inviteeId = req.user!.id;

    const invitation = await service.acceptInvitation(id, inviteeId);

    return res.status(200).json({
      success: true,
      message: 'Invitation accepted successfully',
      data: formatInvitationResponse(invitation),
    });
  } catch (error) {
    next(error);
  }
}

export async function declineInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const inviteeId = req.user!.id;

    const invitation = await service.declineInvitation(id, inviteeId);

    return res.status(200).json({
      success: true,
      message: 'Invitation declined successfully',
      data: formatInvitationResponse(invitation),
    });
  } catch (error) {
    next(error);
  }
}

export async function getInvitationsSent(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const invitations = await repo.findInvitationsSent(userId);

    return res.status(200).json({
      success: true,
      message: 'Sent invitations retrieved successfully',
      data: invitations.map(formatInvitationResponse),
    });
  } catch (error) {
    next(error);
  }
}

export async function getInvitationsReceived(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const invitations = await repo.findInvitationsReceived(userId);

    return res.status(200).json({
      success: true,
      message: 'Received invitations retrieved successfully',
      data: invitations.map(formatInvitationResponse),
    });
  } catch (error) {
    next(error);
  }
}

// --- Direct Membership Handlers ---

export async function addMemberDirectly(req: Request, res: Response, next: NextFunction) {
  try {
    const { tripId } = req.params;
    const organizerId = req.user!.id;
    const { userId, role } = req.body;

    const newMember = await service.addMemberDirectly(tripId, organizerId, userId, role);

    return res.status(201).json({
      success: true,
      message: 'Member added directly to the trip',
      data: newMember,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    const { tripId, userId } = req.params;
    const organizerId = req.user!.id;

    await service.removeMember(tripId, organizerId, userId);

    return res.status(200).json({
      success: true,
      message: 'Member removed from trip successfully',
      data: {},
    });
  } catch (error) {
    next(error);
  }
}

export async function leaveTrip(req: Request, res: Response, next: NextFunction) {
  try {
    const { tripId } = req.params;
    const userId = req.user!.id;

    await service.leaveTrip(tripId, userId);

    return res.status(200).json({
      success: true,
      message: 'Left the trip successfully',
      data: {},
    });
  } catch (error) {
    next(error);
  }
}

export async function promoteMember(req: Request, res: Response, next: NextFunction) {
  try {
    const { tripId, userId } = req.params;
    const organizerId = req.user!.id;
    const { role } = req.body;

    const updatedMember = await service.promoteMember(tripId, organizerId, userId, role);

    return res.status(200).json({
      success: true,
      message: 'Member role updated successfully',
      data: updatedMember,
    });
  } catch (error) {
    next(error);
  }
}
