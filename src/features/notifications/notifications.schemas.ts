import { z } from 'zod';

export const paginationQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().min(1).max(100)),
  cursor: z.string().optional(),
});

export const updatePreferencesSchema = z.object({
  chat: z.boolean().optional(),
  trips: z.boolean().optional(),
  invitations: z.boolean().optional(),
  applications: z.boolean().optional(),
  marketing: z.boolean().optional(),
  system: z.boolean().optional(),
});
