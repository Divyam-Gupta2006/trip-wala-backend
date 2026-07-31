"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTripApplicationsQuerySchema = exports.promoteMemberBodySchema = exports.addMemberBodySchema = exports.inviteUserBodySchema = exports.reviewApplicationBodySchema = exports.applyTripBodySchema = void 0;
const zod_1 = require("zod");
exports.applyTripBodySchema = zod_1.z.object({
    message: zod_1.z.string().max(500, 'Cover letter message cannot exceed 500 characters').optional(),
    coverLetter: zod_1.z.string().max(500, 'Cover letter message cannot exceed 500 characters').optional(),
});
exports.reviewApplicationBodySchema = zod_1.z.object({
    reviewNotes: zod_1.z.string().max(1000, 'Review notes cannot exceed 1000 characters').optional(),
});
exports.inviteUserBodySchema = zod_1.z.object({
    inviteeId: zod_1.z.string().uuid('Invitee ID must be a valid UUID'),
    role: zod_1.z.enum(['organizer', 'coOrganizer', 'member']).default('member'),
});
exports.addMemberBodySchema = zod_1.z.object({
    userId: zod_1.z.string().uuid('User ID must be a valid UUID'),
    role: zod_1.z.enum(['organizer', 'coOrganizer', 'member']).default('member'),
});
exports.promoteMemberBodySchema = zod_1.z.object({
    role: zod_1.z.enum(['organizer', 'coOrganizer', 'member']),
});
exports.getTripApplicationsQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'accepted', 'rejected', 'cancelled']).optional(),
});
