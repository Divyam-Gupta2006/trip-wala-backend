import { Router } from 'express';
import { getCurrentUser } from '../auth/auth.controller';
import { getUserById, deleteUser } from './users.controller';
import { authMiddleware } from '../../core/middlewares';

export const usersRouter = Router();

usersRouter.get('/me', authMiddleware, getCurrentUser);
usersRouter.get('/:id', authMiddleware, getUserById);
usersRouter.delete('/:id', authMiddleware, deleteUser);
