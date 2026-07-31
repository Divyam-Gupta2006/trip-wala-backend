import { Request, Response, NextFunction } from 'express';
import { ProfilesService } from './profiles.service';
import { AuthenticatedRequest } from '../../shared/middleware/auth.middleware';

const profilesService = new ProfilesService();

export class ProfilesController {
  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await profilesService.getProfile(req.params.id);
      res.status(200).json({ success: true, data: profile });
    } catch (e) {
      next(e);
    }
  }

  static async updateMyProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const updated = await profilesService.updateProfile(userId, req.body);
      res.status(200).json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }

  static async getTrustScore(req: Request, res: Response, next: NextFunction) {
    try {
      const score = await profilesService.getTrustScore(req.params.id);
      res.status(200).json({ success: true, data: score });
    } catch (e) {
      next(e);
    }
  }
}
