import { Request, Response, NextFunction } from 'express';
import { TripsService } from './trips.service';
import { AuthenticatedRequest } from '../../shared/middleware/auth.middleware';

const tripsService = new TripsService();

export class TripsController {
  static async getTrips(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;

      const result = await tripsService.getTrips(page, limit, search);
      res.status(200).json({ success: true, ...result });
    } catch (e) {
      next(e);
    }
  }

  static async getTrip(req: Request, res: Response, next: NextFunction) {
    try {
      const trip = await tripsService.getTripById(req.params.id);
      res.status(200).json({ success: true, data: trip });
    } catch (e) {
      next(e);
    }
  }

  static async createTrip(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const trip = await tripsService.createTrip(req.user!.id, req.body);
      res.status(201).json({ success: true, data: trip });
    } catch (e) {
      next(e);
    }
  }

  static async updateTrip(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const trip = await tripsService.updateTrip(req.user!.id, req.params.id, req.body);
      res.status(200).json({ success: true, data: trip });
    } catch (e) {
      next(e);
    }
  }

  static async deleteTrip(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await tripsService.deleteTrip(req.user!.id, req.params.id);
      res.status(200).json({ success: true, message: 'Trip deleted' });
    } catch (e) {
      next(e);
    }
  }
}
