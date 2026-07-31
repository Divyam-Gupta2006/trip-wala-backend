import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  bio: z.string().max(500, 'Bio cannot exceed 500 characters').optional(),
  avatarUrl: z.string().url('Invalid avatar image URL').or(z.string().length(0)).nullable().optional(),
  coverImageUrl: z.string().url('Invalid cover image URL').or(z.string().length(0)).nullable().optional(),
  location: z.string().max(100).optional(),
  interests: z.array(z.string()).optional(),
  travelStyles: z.array(z.string()).optional(),
  travelPreferences: z.array(z.string()).optional(),
  budgetPreference: z.enum(['budget', 'balanced', 'luxury']).optional(),
  socialAccounts: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  age: z.number().int().min(18, 'Must be at least 18 years old').max(120).optional(),
});

export const searchProfilesSchema = z.object({
  query: z.string().optional(),
  minAge: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(18)).optional(),
  maxAge: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().max(120)).optional(),
  budgetPreference: z.enum(['budget', 'balanced', 'luxury']).optional(),
  interests: z.union([z.string(), z.array(z.string())]).transform(val => (Array.isArray(val) ? val : [val])).optional(),
  travelStyles: z.union([z.string(), z.array(z.string())]).transform(val => (Array.isArray(val) ? val : [val])).optional(),
  languages: z.union([z.string(), z.array(z.string())]).transform(val => (Array.isArray(val) ? val : [val])).optional(),
  minTrustScore: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(0)).optional(),
  verifiedOnly: z.string().transform(val => val === 'true').optional(),
  page: z.string().default('1').transform(val => parseInt(val, 10)).pipe(z.number().int().min(1)),
  limit: z.string().default('10').transform(val => parseInt(val, 10)).pipe(z.number().int().min(1).max(100)),
});
