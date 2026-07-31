import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    bio: z.string().optional(),
    avatarUrl: z.string().url('Invalid URL').optional(),
    travelStyles: z.array(z.string()).optional(),
    preferences: z.record(z.any()).optional(),
  }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
