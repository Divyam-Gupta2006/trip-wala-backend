import { z } from 'zod';

// ─── Shared ─────────────────────────────────────────────────────────────────

const participantBaseSchema = z.object({
  userId: z.string().uuid('Participant userId must be a valid UUID'),
  name: z.string().min(1, 'Participant name is required'),
});

const equalParticipantSchema = participantBaseSchema;

const percentageParticipantSchema = participantBaseSchema.extend({
  percentage: z.number().positive('Percentage must be positive').max(100),
});

const customParticipantSchema = participantBaseSchema.extend({
  amount: z.number().positive('Amount must be positive'),
});

// ─── Create Expense ──────────────────────────────────────────────────────────

const baseExpenseSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().max(1000).optional(),
  totalAmount: z.number().positive('Total amount must be positive'),
  currency: z.string().length(3, 'Currency must be a 3-letter ISO code').default('INR'),
  category: z.enum([
    'general', 'food', 'transport', 'accommodation', 'activity',
    'shopping', 'medical', 'communication', 'other',
  ]).default('general'),
  notes: z.string().max(500).optional(),
  receiptUrl: z.string().url('Invalid receipt URL').optional(),
  paidById: z.string().uuid('paidById must be a valid UUID'),
  date: z.string().optional().transform(val => val ? new Date(val) : new Date()),
});

export const createEqualExpenseSchema = baseExpenseSchema.extend({
  splitMethod: z.literal('equal'),
  participants: z.array(equalParticipantSchema).min(2, 'At least 2 participants required'),
});

export const createPercentageExpenseSchema = baseExpenseSchema.extend({
  splitMethod: z.literal('percentage'),
  participants: z.array(percentageParticipantSchema).min(2, 'At least 2 participants required'),
}).refine(
  (data) => {
    const total = data.participants.reduce((sum, p) => sum + p.percentage, 0);
    return Math.abs(total - 100) < 0.01; // tolerance for floating point
  },
  { message: 'Participant percentages must sum to exactly 100%', path: ['participants'] }
);

export const createCustomExpenseSchema = baseExpenseSchema.extend({
  splitMethod: z.literal('custom'),
  participants: z.array(customParticipantSchema).min(2, 'At least 2 participants required'),
}).refine(
  (data) => {
    const total = data.participants.reduce((sum, p) => sum + p.amount, 0);
    return Math.abs(total - data.totalAmount) < 0.01;
  },
  { message: 'Participant amounts must sum to the total expense amount', path: ['participants'] }
);

export const createExpenseSchema = z.union([
  createEqualExpenseSchema,
  createPercentageExpenseSchema,
  createCustomExpenseSchema,
]);

// ─── Update Expense ──────────────────────────────────────────────────────────

export const updateExpenseSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  totalAmount: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  category: z.enum([
    'general', 'food', 'transport', 'accommodation', 'activity',
    'shopping', 'medical', 'communication', 'other',
  ]).optional(),
  notes: z.string().max(500).optional().nullable(),
  receiptUrl: z.string().url().optional().nullable(),
  date: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

// ─── Settlement ───────────────────────────────────────────────────────────────

export const recordSettlementSchema = z.object({
  debtorId: z.string().uuid(),
  creditorId: z.string().uuid(),
  amount: z.number().positive('Settlement amount must be positive'),
  notes: z.string().max(500).optional(),
  paymentReference: z.string().max(200).optional(),
});

export const markSettledSchema = z.object({
  notes: z.string().max(500).optional(),
  paymentReference: z.string().max(200).optional(),
});

// ─── Pagination / Filters ───────────────────────────────────────────────────

export const expenseQuerySchema = z.object({
  category: z.enum([
    'general', 'food', 'transport', 'accommodation', 'activity',
    'shopping', 'medical', 'communication', 'other',
  ]).optional(),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().min(1).max(100)),
});
