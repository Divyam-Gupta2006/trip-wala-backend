"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trustRouter = void 0;
const express_1 = require("express");
const middlewares_1 = require("../../core/middlewares");
const trust_controller_1 = require("./trust.controller");
exports.trustRouter = (0, express_1.Router)();
// Protect all routes with authMiddleware
exports.trustRouter.use(middlewares_1.authMiddleware);
// ─── Trust Score Engine ───────────────────────────────────────────────────────
exports.trustRouter.get('/score', trust_controller_1.getTrustScore);
exports.trustRouter.get('/score/:userId', trust_controller_1.getTrustScore);
exports.trustRouter.post('/score/sync', trust_controller_1.syncTrustScore);
// ─── Ratings ──────────────────────────────────────────────────────────────────
exports.trustRouter.post('/ratings', trust_controller_1.createRating);
exports.trustRouter.get('/ratings/user/:userId', trust_controller_1.listRatings);
exports.trustRouter.get('/ratings/user/:userId/analytics', trust_controller_1.getRatingAnalytics);
// ─── Identity Verification ─────────────────────────────────────────────────────
exports.trustRouter.get('/verification', trust_controller_1.getVerificationState);
exports.trustRouter.post('/verification/request', trust_controller_1.requestVerification);
exports.trustRouter.put('/verification/:userId/status', trust_controller_1.updateVerificationStatus); // Helper endpoint for verification status updates (e.g. admin workflow)
// ─── Guardians ────────────────────────────────────────────────────────────────
exports.trustRouter.get('/guardians', trust_controller_1.listGuardians);
exports.trustRouter.post('/guardians', trust_controller_1.addGuardian);
exports.trustRouter.put('/guardians/:id', trust_controller_1.updateGuardian);
exports.trustRouter.delete('/guardians/:id', trust_controller_1.removeGuardian);
// ─── Travel Memories ─────────────────────────────────────────────────────────
exports.trustRouter.post('/memories', trust_controller_1.createMemory);
exports.trustRouter.get('/memories/user/:userId', trust_controller_1.listMemories);
exports.trustRouter.put('/memories/:id', trust_controller_1.updateMemory);
exports.trustRouter.delete('/memories/:id', trust_controller_1.deleteMemory);
