import { z } from 'zod';

// ─── Rating ───────────────────────────────────────────────────────────────────

const ratingScore = z.number().int().min(1, 'Must be at least 1').max(5, 'Must be at most 5');

export const createRatingSchema = z.object({
  rateeId: z.string().uuid('rateeId must be a valid UUID'),
  tripId: z.string().uuid('tripId must be a valid UUID'),
  reliability: ratingScore,
  communication: ratingScore,
  respectfulness: ratingScore,
  socialCompatibility: ratingScore,
  funToTravelWith: ratingScore,
  planningContribution: ratingScore,
  review: z.string().max(1000, 'Review must not exceed 1000 characters').optional(),
});

// ─── Guardian ─────────────────────────────────────────────────────────────────

export const createGuardianSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z
    .string()
    .min(7, 'Phone number is too short')
    .max(20, 'Phone number is too long')
    .regex(/^\+?[\d\s\-().]+$/, 'Invalid phone number format'),
  relationship: z.string().min(2, 'Relationship is required').max(50),
  email: z.string().email('Invalid email').optional(),
  notes: z.string().max(500).optional(),
  isPrimaryEmergencyContact: z.boolean().default(false),
});

export const updateGuardianSchema = createGuardianSchema.partial();

// ─── Travel Memory ────────────────────────────────────────────────────────────

export const createMemorySchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  destination: z.string().max(200).optional(),
  tripId: z.string().uuid('tripId must be a valid UUID').optional(),
  mediaUrl: z.string().url('Invalid media URL').optional(),
  mediaUrls: z.array(z.string().url('Invalid URL in mediaUrls')).max(20).default([]),
  visibility: z.enum(['public', 'friends', 'private']).default('public'),
  date: z.string().optional().transform((v) => (v ? new Date(v) : new Date())),
});

export const updateMemorySchema = createMemorySchema.partial();

// ─── Verification ─────────────────────────────────────────────────────────────

export const requestVerificationSchema = z.object({
  type: z.enum(['phone', 'governmentId', 'social'], {
    errorMap: () => ({ message: 'Type must be one of: phone, governmentId, social' }),
  }),
});

// Admin-only in future — kept minimal for now
export const updateVerificationStatusSchema = z.object({
  type: z.enum(['phone', 'governmentId', 'social']),
  status: z.enum(['notStarted', 'pending', 'verified']),
});

// ─── Pagination ───────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().min(1).max(100)),
  cursor: z.string().optional(),
});
