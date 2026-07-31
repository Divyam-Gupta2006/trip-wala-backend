import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateRequest } from '../../shared/middleware/zod.middleware';
import { registerSchema, loginSchema, refreshTokenSchema } from './auth.dto';
import { authenticateJWT } from '../../shared/middleware/auth.middleware';

const router = Router();

router.post('/register', validateRequest(registerSchema), AuthController.register);
router.post('/login', validateRequest(loginSchema), AuthController.login);
router.post('/refresh', validateRequest(refreshTokenSchema), AuthController.refresh);

// Protected logout endpoint
router.post('/logout', authenticateJWT, AuthController.logout);

export default router;
