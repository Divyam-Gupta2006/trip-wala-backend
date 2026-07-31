import { Request, Response, NextFunction } from 'express';
import { trustService } from './trust.service';
import {
  createRatingSchema,
  createGuardianSchema,
  updateGuardianSchema,
  createMemorySchema,
  updateMemorySchema,
  requestVerificationSchema,
  updateVerificationStatusSchema,
  paginationSchema,
} from './trust.schemas';

// ─── Trust Score Engine ───────────────────────────────────────────────────────

export async function getTrustScore(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.userId || req.user!.id;
    const breakdown = await trustService.getTrustScoreAndBreakdown(userId);
    res.status(200).json({ success: true, data: breakdown });
  } catch (err) {
    next(err);
  }
}

export async function syncTrustScore(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const score = await trustService.calculateAndSyncTrustScore(userId);
    res.status(200).json({ success: true, data: { score } });
  } catch (err) {
    next(err);
  }
}

// ─── Ratings ──────────────────────────────────────────────────────────────────

export async function createRating(req: Request, res: Response, next: NextFunction) {
  try {
    const raterId = req.user!.id;
    const validated = createRatingSchema.parse(req.body);

    const rating = await trustService.createRating(raterId, validated);
    res.status(201).json({ success: true, data: rating });
  } catch (err) {
    next(err);
  }
}

export async function listRatings(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const { limit, cursor } = paginationSchema.parse(req.query);

    const result = await trustService.listRatingsForUser(userId, { limit, cursor });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getRatingAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const analytics = await trustService.getUserRatingAnalytics(userId);
    res.status(200).json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
}

// ─── Identity Verification ─────────────────────────────────────────────────────

export async function getVerificationState(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const state = await trustService.getVerificationState(userId);
    res.status(200).json({ success: true, data: state });
  } catch (err) {
    next(err);
  }
}

export async function requestVerification(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { type } = requestVerificationSchema.parse(req.body);

    const updated = await trustService.requestVerification(userId, type);
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function updateVerificationStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const { type, status } = updateVerificationStatusSchema.parse(req.body);

    const updated = await trustService.updateVerificationStatus(userId, type, status);
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ─── Guardians ────────────────────────────────────────────────────────────────

export async function addGuardian(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const validated = createGuardianSchema.parse(req.body);

    const guardian = await trustService.addGuardian(userId, validated);
    res.status(201).json({ success: true, data: guardian });
  } catch (err) {
    next(err);
  }
}

export async function listGuardians(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const guardians = await trustService.listGuardians(userId);
    res.status(200).json({ success: true, data: guardians });
  } catch (err) {
    next(err);
  }
}

export async function updateGuardian(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const validated = updateGuardianSchema.parse(req.body);

    const updated = await trustService.updateGuardian(userId, id, validated);
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function removeGuardian(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await trustService.removeGuardian(userId, id);
    res.status(200).json({ success: true, message: 'Guardian removed successfully.' });
  } catch (err) {
    next(err);
  }
}

// ─── Travel Memories ─────────────────────────────────────────────────────────

export async function createMemory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const validated = createMemorySchema.parse(req.body);

    const memory = await trustService.createMemory(userId, validated);
    res.status(201).json({ success: true, data: memory });
  } catch (err) {
    next(err);
  }
}

export async function listMemories(req: Request, res: Response, next: NextFunction) {
  try {
    const viewerId = req.user!.id;
    const { userId } = req.params;
    const { limit, cursor } = paginationSchema.parse(req.query);

    const result = await trustService.listMemories(userId, viewerId, { limit, cursor });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function updateMemory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const validated = updateMemorySchema.parse(req.body);

    const updated = await trustService.updateMemory(userId, id, validated);
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteMemory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await trustService.deleteMemory(userId, id);
    res.status(200).json({ success: true, message: 'Memory deleted successfully.' });
  } catch (err) {
    next(err);
  }
}
