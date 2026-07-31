import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
        id: string;
        email: string;
        name: string;
      };
      sessionId?: string;
    }
  }
}
