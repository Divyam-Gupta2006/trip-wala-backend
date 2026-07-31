"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expenseQuerySchema = exports.markSettledSchema = exports.recordSettlementSchema = exports.updateExpenseSchema = exports.createExpenseSchema = exports.createCustomExpenseSchema = exports.createPercentageExpenseSchema = exports.createEqualExpenseSchema = void 0;
const zod_1 = require("zod");
// ─── Shared ─────────────────────────────────────────────────────────────────
const participantBaseSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid('Participant userId must be a valid UUID'),
    name: zod_1.z.string().min(1, 'Participant name is required'),
});
const equalParticipantSchema = participantBaseSchema;
const percentageParticipantSchema = participantBaseSchema.extend({
    percentage: zod_1.z.number().positive('Percentage must be positive').max(100),
});
const customParticipantSchema = participantBaseSchema.extend({
    amount: zod_1.z.number().positive('Amount must be positive'),
});
// ─── Create Expense ──────────────────────────────────────────────────────────
const baseExpenseSchema = zod_1.z.object({
    title: zod_1.z.string().min(2, 'Title must be at least 2 characters').max(200),
    description: zod_1.z.string().max(1000).optional(),
    totalAmount: zod_1.z.number().positive('Total amount must be positive'),
    currency: zod_1.z.string().length(3, 'Currency must be a 3-letter ISO code').default('INR'),
    category: zod_1.z.enum([
        'general', 'food', 'transport', 'accommodation', 'activity',
        'shopping', 'medical', 'communication', 'other',
    ]).default('general'),
    notes: zod_1.z.string().max(500).optional(),
    receiptUrl: zod_1.z.string().url('Invalid receipt URL').optional(),
    paidById: zod_1.z.string().uuid('paidById must be a valid UUID'),
    date: zod_1.z.string().optional().transform(val => val ? new Date(val) : new Date()),
});
exports.createEqualExpenseSchema = baseExpenseSchema.extend({
    splitMethod: zod_1.z.literal('equal'),
    participants: zod_1.z.array(equalParticipantSchema).min(2, 'At least 2 participants required'),
});
exports.createPercentageExpenseSchema = baseExpenseSchema.extend({
    splitMethod: zod_1.z.literal('percentage'),
    participants: zod_1.z.array(percentageParticipantSchema).min(2, 'At least 2 participants required'),
}).refine((data) => {
    const total = data.participants.reduce((sum, p) => sum + p.percentage, 0);
    return Math.abs(total - 100) < 0.01; // tolerance for floating point
}, { message: 'Participant percentages must sum to exactly 100%', path: ['participants'] });
exports.createCustomExpenseSchema = baseExpenseSchema.extend({
    splitMethod: zod_1.z.literal('custom'),
    participants: zod_1.z.array(customParticipantSchema).min(2, 'At least 2 participants required'),
}).refine((data) => {
    const total = data.participants.reduce((sum, p) => sum + p.amount, 0);
    return Math.abs(total - data.totalAmount) < 0.01;
}, { message: 'Participant amounts must sum to the total expense amount', path: ['participants'] });
exports.createExpenseSchema = zod_1.z.union([
    exports.createEqualExpenseSchema,
    exports.createPercentageExpenseSchema,
    exports.createCustomExpenseSchema,
]);
// ─── Update Expense ──────────────────────────────────────────────────────────
exports.updateExpenseSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(200).optional(),
    description: zod_1.z.string().max(1000).optional().nullable(),
    totalAmount: zod_1.z.number().positive().optional(),
    currency: zod_1.z.string().length(3).optional(),
    category: zod_1.z.enum([
        'general', 'food', 'transport', 'accommodation', 'activity',
        'shopping', 'medical', 'communication', 'other',
    ]).optional(),
    notes: zod_1.z.string().max(500).optional().nullable(),
    receiptUrl: zod_1.z.string().url().optional().nullable(),
    date: zod_1.z.string().optional().transform(val => val ? new Date(val) : undefined),
});
// ─── Settlement ───────────────────────────────────────────────────────────────
exports.recordSettlementSchema = zod_1.z.object({
    debtorId: zod_1.z.string().uuid(),
    creditorId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive('Settlement amount must be positive'),
    notes: zod_1.z.string().max(500).optional(),
    paymentReference: zod_1.z.string().max(200).optional(),
});
exports.markSettledSchema = zod_1.z.object({
    notes: zod_1.z.string().max(500).optional(),
    paymentReference: zod_1.z.string().max(200).optional(),
});
// ─── Pagination / Filters ───────────────────────────────────────────────────
exports.expenseQuerySchema = zod_1.z.object({
    category: zod_1.z.enum([
        'general', 'food', 'transport', 'accommodation', 'activity',
        'shopping', 'medical', 'communication', 'other',
    ]).optional(),
    cursor: zod_1.z.string().optional(),
    limit: zod_1.z
        .string()
        .optional()
        .transform(val => (val ? parseInt(val, 10) : 20))
        .pipe(zod_1.z.number().min(1).max(100)),
});
