import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';

const authService = new AuthService();

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({
        success: true,
        user: result.user,
        token: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });
    } catch (e) {
      next(e);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const device = req.headers['user-agent'];
      const ipAddress = req.ip;
      
      const result = await authService.login(req.body, device, ipAddress);
      res.status(200).json({
        success: true,
        user: result.user,
        token: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });
    } catch (e) {
      next(e);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.refresh(req.body.refreshToken);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (e) {
      next(e);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      // Allow passing refresh token in body or query
      const token = req.body.refreshToken || req.query.refreshToken;
      if (token) {
        await authService.logout(token);
      }
      res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (e) {
      next(e);
    }
  }
}
