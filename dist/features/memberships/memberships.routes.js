"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.membershipsRouter = void 0;
const express_1 = require("express");
const middlewares_1 = require("../../core/middlewares");
const memberships_controller_1 = require("./memberships.controller");
const memberships_schemas_1 = require("./memberships.schemas");
exports.membershipsRouter = (0, express_1.Router)();
// Enforce authentication globally for memberships
exports.membershipsRouter.use(middlewares_1.authMiddleware);
// --- Applications ---
exports.membershipsRouter.post('/trips/:tripId/applications', (0, middlewares_1.validateBody)(memberships_schemas_1.applyTripBodySchema), memberships_controller_1.applyToTrip);
// Backward compatibility with API_CONTRACTS.md: POST /trips/:id/apply
exports.membershipsRouter.post('/trips/:tripId/apply', (0, middlewares_1.validateBody)(memberships_schemas_1.applyTripBodySchema), memberships_controller_1.applyToTrip);
exports.membershipsRouter.get('/trips/:tripId/applications', (0, middlewares_1.validateQuery)(memberships_schemas_1.getTripApplicationsQuerySchema), memberships_controller_1.getTripApplications);
exports.membershipsRouter.get('/applications/me', memberships_controller_1.getMyApplications);
exports.membershipsRouter.get('/applications/:id', memberships_controller_1.getApplicationDetails);
exports.membershipsRouter.post('/applications/:id/cancel', memberships_controller_1.cancelApplication);
exports.membershipsRouter.post('/applications/:id/accept', (0, middlewares_1.validateBody)(memberships_schemas_1.reviewApplicationBodySchema), memberships_controller_1.acceptApplication);
exports.membershipsRouter.post('/applications/:id/reject', (0, middlewares_1.validateBody)(memberships_schemas_1.reviewApplicationBodySchema), memberships_controller_1.rejectApplication);
// --- Invitations ---
exports.membershipsRouter.post('/trips/:tripId/invitations', (0, middlewares_1.validateBody)(memberships_schemas_1.inviteUserBodySchema), memberships_controller_1.inviteUser);
exports.membershipsRouter.get('/invitations/sent', memberships_controller_1.getInvitationsSent);
exports.membershipsRouter.get('/invitations/received', memberships_controller_1.getInvitationsReceived);
exports.membershipsRouter.post('/invitations/:id/cancel', memberships_controller_1.cancelInvitation);
exports.membershipsRouter.post('/invitations/:id/accept', memberships_controller_1.acceptInvitation);
exports.membershipsRouter.post('/invitations/:id/decline', memberships_controller_1.declineInvitation);
// --- Direct Member Management ---
exports.membershipsRouter.post('/trips/:tripId/members', (0, middlewares_1.validateBody)(memberships_schemas_1.addMemberBodySchema), memberships_controller_1.addMemberDirectly);
exports.membershipsRouter.delete('/trips/:tripId/members/:userId', memberships_controller_1.removeMember);
exports.membershipsRouter.post('/trips/:tripId/leave', memberships_controller_1.leaveTrip);
exports.membershipsRouter.patch('/trips/:tripId/members/:userId/role', (0, middlewares_1.validateBody)(memberships_schemas_1.promoteMemberBodySchema), memberships_controller_1.promoteMember);
