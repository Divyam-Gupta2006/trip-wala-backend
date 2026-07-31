import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares';
import { validateBody, validateQuery } from '../../core/middlewares';
import {
  createTrip,
  getTripById,
  updateTrip,
  deleteTrip,
  searchTrips,
  getUserTrips,
} from './trips.controller';
import {
  createTripSchema,
  updateTripSchema,
  searchTripsSchema,
} from './trips.schemas';

export const tripsRouter = Router();

// Apply authMiddleware globally to all trip routes
tripsRouter.use(authMiddleware);

// Core CRUD and Search
tripsRouter.post('/', validateBody(createTripSchema), createTrip);
tripsRouter.get('/', validateQuery(searchTripsSchema), searchTrips);
tripsRouter.get('/:id', getTripById);
tripsRouter.put('/:id', validateBody(updateTripSchema), updateTrip);
tripsRouter.delete('/:id', deleteTrip);

// User Trips Retrievals
tripsRouter.get('/user/:userId', getUserTrips);
tripsRouter.get('/user/:userId/hosted', getUserTrips);
tripsRouter.get('/user/:userId/joined', getUserTrips);
