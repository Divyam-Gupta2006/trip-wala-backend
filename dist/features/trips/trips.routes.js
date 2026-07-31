"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tripsRouter = void 0;
const express_1 = require("express");
const middlewares_1 = require("../../core/middlewares");
const middlewares_2 = require("../../core/middlewares");
const trips_controller_1 = require("./trips.controller");
const trips_schemas_1 = require("./trips.schemas");
exports.tripsRouter = (0, express_1.Router)();
// Apply authMiddleware globally to all trip routes
exports.tripsRouter.use(middlewares_1.authMiddleware);
// Core CRUD and Search
exports.tripsRouter.post('/', (0, middlewares_2.validateBody)(trips_schemas_1.createTripSchema), trips_controller_1.createTrip);
exports.tripsRouter.get('/', (0, middlewares_2.validateQuery)(trips_schemas_1.searchTripsSchema), trips_controller_1.searchTrips);
exports.tripsRouter.get('/:id', trips_controller_1.getTripById);
exports.tripsRouter.put('/:id', (0, middlewares_2.validateBody)(trips_schemas_1.updateTripSchema), trips_controller_1.updateTrip);
exports.tripsRouter.delete('/:id', trips_controller_1.deleteTrip);
// User Trips Retrievals
exports.tripsRouter.get('/user/:userId', trips_controller_1.getUserTrips);
exports.tripsRouter.get('/user/:userId/hosted', trips_controller_1.getUserTrips);
exports.tripsRouter.get('/user/:userId/joined', trips_controller_1.getUserTrips);
