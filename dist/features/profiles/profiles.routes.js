"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profilesRouter = void 0;
const express_1 = require("express");
const middlewares_1 = require("../../core/middlewares");
const profiles_controller_1 = require("./profiles.controller");
const profiles_schemas_1 = require("./profiles.schemas");
exports.profilesRouter = (0, express_1.Router)();
// Search profiles
exports.profilesRouter.get('/', middlewares_1.authMiddleware, (0, middlewares_1.validateQuery)(profiles_schemas_1.searchProfilesSchema), profiles_controller_1.searchProfiles);
// Get profile by user ID
exports.profilesRouter.get('/:userId', middlewares_1.authMiddleware, profiles_controller_1.getProfileById);
// Update profile
exports.profilesRouter.put('/:userId', middlewares_1.authMiddleware, (0, middlewares_1.validateBody)(profiles_schemas_1.updateProfileSchema), profiles_controller_1.updateProfile);
