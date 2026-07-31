import { z } from 'zod';

export const applyTripBodySchema = z.object({
  message: z.string().max(500, 'Cover letter message cannot exceed 500 characters').optional(),
  coverLetter: z.string().max(500, 'Cover letter message cannot exceed 500 characters').optional(),
});

export const reviewApplicationBodySchema = z.object({
  reviewNotes: z.string().max(1000, 'Review notes cannot exceed 1000 characters').optional(),
});

export const inviteUserBodySchema = z.object({
  inviteeId: z.string().uuid('Invitee ID must be a valid UUID'),
  role: z.enum(['organizer', 'coOrganizer', 'member']).default('member'),
});

export const addMemberBodySchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID'),
  role: z.enum(['organizer', 'coOrganizer', 'member']).default('member'),
});

export const promoteMemberBodySchema = z.object({
  role: z.enum(['organizer', 'coOrganizer', 'member']),
});

export const getTripApplicationsQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected', 'cancelled']).optional(),
});
