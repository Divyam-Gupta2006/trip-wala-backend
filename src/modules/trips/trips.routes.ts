import { Router } from 'express';
import { TripsController } from './trips.controller';
import { authenticateJWT } from '../../shared/middleware/auth.middleware';
import { validateRequest } from '../../shared/middleware/zod.middleware';
import { createTripSchema, updateTripSchema } from './trips.dto';

const router = Router();

router.get('/', TripsController.getTrips);
router.get('/:id', TripsController.getTrip);

// Protected routes
router.use(authenticateJWT);
router.post('/', validateRequest(createTripSchema), TripsController.createTrip);
router.put('/:id', validateRequest(updateTripSchema), TripsController.updateTrip);
router.delete('/:id', TripsController.deleteTrip);

export default router;
