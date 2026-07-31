import { Router } from 'express';
import { ProfilesController } from './profiles.controller';
import { authenticateJWT } from '../../shared/middleware/auth.middleware';
import { validateRequest } from '../../shared/middleware/zod.middleware';
import { updateProfileSchema } from './profiles.dto';

const router = Router();

router.get('/:id', authenticateJWT, ProfilesController.getProfile);
router.put('/me', authenticateJWT, validateRequest(updateProfileSchema), ProfilesController.updateMyProfile);
router.get('/:id/trust-score', authenticateJWT, ProfilesController.getTrustScore);

export default router;
