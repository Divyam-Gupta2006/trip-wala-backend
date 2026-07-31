"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginationSchema = exports.updateVerificationStatusSchema = exports.requestVerificationSchema = exports.updateMemorySchema = exports.createMemorySchema = exports.updateGuardianSchema = exports.createGuardianSchema = exports.createRatingSchema = void 0;
const zod_1 = require("zod");
// ─── Rating ───────────────────────────────────────────────────────────────────
const ratingScore = zod_1.z.number().int().min(1, 'Must be at least 1').max(5, 'Must be at most 5');
exports.createRatingSchema = zod_1.z.object({
    rateeId: zod_1.z.string().uuid('rateeId must be a valid UUID'),
    tripId: zod_1.z.string().uuid('tripId must be a valid UUID'),
    reliability: ratingScore,
    communication: ratingScore,
    respectfulness: ratingScore,
    socialCompatibility: ratingScore,
    funToTravelWith: ratingScore,
    planningContribution: ratingScore,
    review: zod_1.z.string().max(1000, 'Review must not exceed 1000 characters').optional(),
});
// ─── Guardian ─────────────────────────────────────────────────────────────────
exports.createGuardianSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters').max(100),
    phone: zod_1.z
        .string()
        .min(7, 'Phone number is too short')
        .max(20, 'Phone number is too long')
        .regex(/^\+?[\d\s\-().]+$/, 'Invalid phone number format'),
    relationship: zod_1.z.string().min(2, 'Relationship is required').max(50),
    email: zod_1.z.string().email('Invalid email').optional(),
    notes: zod_1.z.string().max(500).optional(),
    isPrimaryEmergencyContact: zod_1.z.boolean().default(false),
});
exports.updateGuardianSchema = exports.createGuardianSchema.partial();
// ─── Travel Memory ────────────────────────────────────────────────────────────
exports.createMemorySchema = zod_1.z.object({
    title: zod_1.z.string().min(2, 'Title must be at least 2 characters').max(200),
    description: zod_1.z.string().min(1, 'Description is required').max(2000),
    destination: zod_1.z.string().max(200).optional(),
    tripId: zod_1.z.string().uuid('tripId must be a valid UUID').optional(),
    mediaUrl: zod_1.z.string().url('Invalid media URL').optional(),
    mediaUrls: zod_1.z.array(zod_1.z.string().url('Invalid URL in mediaUrls')).max(20).default([]),
    visibility: zod_1.z.enum(['public', 'friends', 'private']).default('public'),
    date: zod_1.z.string().optional().transform((v) => (v ? new Date(v) : new Date())),
});
exports.updateMemorySchema = exports.createMemorySchema.partial();
// ─── Verification ─────────────────────────────────────────────────────────────
exports.requestVerificationSchema = zod_1.z.object({
    type: zod_1.z.enum(['phone', 'governmentId', 'social'], {
        errorMap: () => ({ message: 'Type must be one of: phone, governmentId, social' }),
    }),
});
// Admin-only in future — kept minimal for now
exports.updateVerificationStatusSchema = zod_1.z.object({
    type: zod_1.z.enum(['phone', 'governmentId', 'social']),
    status: zod_1.z.enum(['notStarted', 'pending', 'verified']),
});
// ─── Pagination ───────────────────────────────────────────────────────────────
exports.paginationSchema = zod_1.z.object({
    limit: zod_1.z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 20))
        .pipe(zod_1.z.number().min(1).max(100)),
    cursor: zod_1.z.string().optional(),
});
