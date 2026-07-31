import { Router } from 'express';
import { authMiddleware, validateBody, validateQuery } from '../../core/middlewares';
import {
  applyToTrip,
  cancelApplication,
  acceptApplication,
  rejectApplication,
  getMyApplications,
  getTripApplications,
  getApplicationDetails,
  inviteUser,
  cancelInvitation,
  acceptInvitation,
  declineInvitation,
  getInvitationsSent,
  getInvitationsReceived,
  addMemberDirectly,
  removeMember,
  leaveTrip,
  promoteMember,
} from './memberships.controller';
import {
  applyTripBodySchema,
  reviewApplicationBodySchema,
  inviteUserBodySchema,
  addMemberBodySchema,
  promoteMemberBodySchema,
  getTripApplicationsQuerySchema,
} from './memberships.schemas';

export const membershipsRouter = Router();

// Enforce authentication globally for memberships
membershipsRouter.use(authMiddleware);

// --- Applications ---
membershipsRouter.post('/trips/:tripId/applications', validateBody(applyTripBodySchema), applyToTrip);
// Backward compatibility with API_CONTRACTS.md: POST /trips/:id/apply
membershipsRouter.post('/trips/:tripId/apply', validateBody(applyTripBodySchema), applyToTrip);

membershipsRouter.get('/trips/:tripId/applications', validateQuery(getTripApplicationsQuerySchema), getTripApplications);
membershipsRouter.get('/applications/me', getMyApplications);
membershipsRouter.get('/applications/:id', getApplicationDetails);
membershipsRouter.post('/applications/:id/cancel', cancelApplication);
membershipsRouter.post('/applications/:id/accept', validateBody(reviewApplicationBodySchema), acceptApplication);
membershipsRouter.post('/applications/:id/reject', validateBody(reviewApplicationBodySchema), rejectApplication);

// --- Invitations ---
membershipsRouter.post('/trips/:tripId/invitations', validateBody(inviteUserBodySchema), inviteUser);
membershipsRouter.get('/invitations/sent', getInvitationsSent);
membershipsRouter.get('/invitations/received', getInvitationsReceived);
membershipsRouter.post('/invitations/:id/cancel', cancelInvitation);
membershipsRouter.post('/invitations/:id/accept', acceptInvitation);
membershipsRouter.post('/invitations/:id/decline', declineInvitation);

// --- Direct Member Management ---
membershipsRouter.post('/trips/:tripId/members', validateBody(addMemberBodySchema), addMemberDirectly);
membershipsRouter.delete('/trips/:tripId/members/:userId', removeMember);
membershipsRouter.post('/trips/:tripId/leave', leaveTrip);
membershipsRouter.patch('/trips/:tripId/members/:userId/role', validateBody(promoteMemberBodySchema), promoteMember);
