import { Router } from 'express';
import { authMiddleware, validateBody, validateQuery } from '../../core/middlewares';
import { getProfileById, updateProfile, searchProfiles } from './profiles.controller';
import { updateProfileSchema, searchProfilesSchema } from './profiles.schemas';

export const profilesRouter = Router();

// Search profiles
profilesRouter.get(
  '/',
  authMiddleware,
  validateQuery(searchProfilesSchema),
  searchProfiles
);

// Get profile by user ID
profilesRouter.get(
  '/:userId',
  authMiddleware,
  getProfileById
);

// Update profile
profilesRouter.put(
  '/:userId',
  authMiddleware,
  validateBody(updateProfileSchema),
  updateProfile
);
