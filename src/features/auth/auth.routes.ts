import { Router } from 'express';
import { register, login, refresh, logout, getCurrentUser } from './auth.controller';
import { registerSchema, loginSchema, refreshSchema } from './auth.schemas';
import { validateBody, authMiddleware } from '../../core/middlewares';

export const authRouter = Router();

// Public routes
authRouter.post('/register', validateBody(registerSchema), register);
authRouter.post('/login', validateBody(loginSchema), login);
authRouter.post('/refresh', validateBody(refreshSchema), refresh);

// Protected routes
authRouter.post('/logout', authMiddleware, logout);
authRouter.get('/me', authMiddleware, getCurrentUser);
