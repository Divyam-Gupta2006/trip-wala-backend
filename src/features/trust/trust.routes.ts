import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares';
import {
  getTrustScore,
  syncTrustScore,
  createRating,
  listRatings,
  getRatingAnalytics,
  getVerificationState,
  requestVerification,
  updateVerificationStatus,
  addGuardian,
  listGuardians,
  updateGuardian,
  removeGuardian,
  createMemory,
  listMemories,
  updateMemory,
  deleteMemory,
} from './trust.controller';

export const trustRouter = Router();

// Protect all routes with authMiddleware
trustRouter.use(authMiddleware);

// ─── Trust Score Engine ───────────────────────────────────────────────────────
trustRouter.get('/score', getTrustScore);
trustRouter.get('/score/:userId', getTrustScore);
trustRouter.post('/score/sync', syncTrustScore);

// ─── Ratings ──────────────────────────────────────────────────────────────────
trustRouter.post('/ratings', createRating);
trustRouter.get('/ratings/user/:userId', listRatings);
trustRouter.get('/ratings/user/:userId/analytics', getRatingAnalytics);

// ─── Identity Verification ─────────────────────────────────────────────────────
trustRouter.get('/verification', getVerificationState);
trustRouter.post('/verification/request', requestVerification);
trustRouter.put('/verification/:userId/status', updateVerificationStatus); // Helper endpoint for verification status updates (e.g. admin workflow)

// ─── Guardians ────────────────────────────────────────────────────────────────
trustRouter.get('/guardians', listGuardians);
trustRouter.post('/guardians', addGuardian);
trustRouter.put('/guardians/:id', updateGuardian);
trustRouter.delete('/guardians/:id', removeGuardian);

// ─── Travel Memories ─────────────────────────────────────────────────────────
trustRouter.post('/memories', createMemory);
trustRouter.get('/memories/user/:userId', listMemories);
trustRouter.put('/memories/:id', updateMemory);
trustRouter.delete('/memories/:id', deleteMemory);
