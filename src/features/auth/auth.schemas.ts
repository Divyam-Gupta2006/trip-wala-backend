import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  deviceId: z.string().optional(),
  age: z.number().int().min(18, 'Must be at least 18 years old').default(18),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string(),
  deviceId: z.string().optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string({
    required_error: 'Refresh token is required',
  }),
});
