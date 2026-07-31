import { z } from 'zod';

export const createTripSchema = z.object({
  body: z.object({
    title: z.string().min(3),
    description: z.string().min(10),
    destination: z.string().min(2),
    imageUrl: z.string().url().optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    isHosted: z.boolean().default(false),
  }),
});

export const updateTripSchema = z.object({
  body: z.object({
    title: z.string().min(3).optional(),
    description: z.string().min(10).optional(),
    destination: z.string().min(2).optional(),
    imageUrl: z.string().url().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    status: z.enum(['UPCOMING', 'ONGOING', 'COMPLETED']).optional(),
  }),
});

export type CreateTripInput = z.infer<typeof createTripSchema>['body'];
export type UpdateTripInput = z.infer<typeof updateTripSchema>['body'];
