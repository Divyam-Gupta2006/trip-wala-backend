"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrustScore = getTrustScore;
exports.syncTrustScore = syncTrustScore;
exports.createRating = createRating;
exports.listRatings = listRatings;
exports.getRatingAnalytics = getRatingAnalytics;
exports.getVerificationState = getVerificationState;
exports.requestVerification = requestVerification;
exports.updateVerificationStatus = updateVerificationStatus;
exports.addGuardian = addGuardian;
exports.listGuardians = listGuardians;
exports.updateGuardian = updateGuardian;
exports.removeGuardian = removeGuardian;
exports.createMemory = createMemory;
exports.listMemories = listMemories;
exports.updateMemory = updateMemory;
exports.deleteMemory = deleteMemory;
const trust_service_1 = require("./trust.service");
const trust_schemas_1 = require("./trust.schemas");
// ─── Trust Score Engine ───────────────────────────────────────────────────────
async function getTrustScore(req, res, next) {
    try {
        const userId = req.params.userId || req.user.id;
        const breakdown = await trust_service_1.trustService.getTrustScoreAndBreakdown(userId);
        res.status(200).json({ success: true, data: breakdown });
    }
    catch (err) {
        next(err);
    }
}
async function syncTrustScore(req, res, next) {
    try {
        const userId = req.user.id;
        const score = await trust_service_1.trustService.calculateAndSyncTrustScore(userId);
        res.status(200).json({ success: true, data: { score } });
    }
    catch (err) {
        next(err);
    }
}
// ─── Ratings ──────────────────────────────────────────────────────────────────
async function createRating(req, res, next) {
    try {
        const raterId = req.user.id;
        const validated = trust_schemas_1.createRatingSchema.parse(req.body);
        const rating = await trust_service_1.trustService.createRating(raterId, validated);
        res.status(201).json({ success: true, data: rating });
    }
    catch (err) {
        next(err);
    }
}
async function listRatings(req, res, next) {
    try {
        const { userId } = req.params;
        const { limit, cursor } = trust_schemas_1.paginationSchema.parse(req.query);
        const result = await trust_service_1.trustService.listRatingsForUser(userId, { limit, cursor });
        res.status(200).json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
}
async function getRatingAnalytics(req, res, next) {
    try {
        const { userId } = req.params;
        const analytics = await trust_service_1.trustService.getUserRatingAnalytics(userId);
        res.status(200).json({ success: true, data: analytics });
    }
    catch (err) {
        next(err);
    }
}
// ─── Identity Verification ─────────────────────────────────────────────────────
async function getVerificationState(req, res, next) {
    try {
        const userId = req.user.id;
        const state = await trust_service_1.trustService.getVerificationState(userId);
        res.status(200).json({ success: true, data: state });
    }
    catch (err) {
        next(err);
    }
}
async function requestVerification(req, res, next) {
    try {
        const userId = req.user.id;
        const { type } = trust_schemas_1.requestVerificationSchema.parse(req.body);
        const updated = await trust_service_1.trustService.requestVerification(userId, type);
        res.status(200).json({ success: true, data: updated });
    }
    catch (err) {
        next(err);
    }
}
async function updateVerificationStatus(req, res, next) {
    try {
        const { userId } = req.params;
        const { type, status } = trust_schemas_1.updateVerificationStatusSchema.parse(req.body);
        const updated = await trust_service_1.trustService.updateVerificationStatus(userId, type, status);
        res.status(200).json({ success: true, data: updated });
    }
    catch (err) {
        next(err);
    }
}
// ─── Guardians ────────────────────────────────────────────────────────────────
async function addGuardian(req, res, next) {
    try {
        const userId = req.user.id;
        const validated = trust_schemas_1.createGuardianSchema.parse(req.body);
        const guardian = await trust_service_1.trustService.addGuardian(userId, validated);
        res.status(201).json({ success: true, data: guardian });
    }
    catch (err) {
        next(err);
    }
}
async function listGuardians(req, res, next) {
    try {
        const userId = req.user.id;
        const guardians = await trust_service_1.trustService.listGuardians(userId);
        res.status(200).json({ success: true, data: guardians });
    }
    catch (err) {
        next(err);
    }
}
async function updateGuardian(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const validated = trust_schemas_1.updateGuardianSchema.parse(req.body);
        const updated = await trust_service_1.trustService.updateGuardian(userId, id, validated);
        res.status(200).json({ success: true, data: updated });
    }
    catch (err) {
        next(err);
    }
}
async function removeGuardian(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        await trust_service_1.trustService.removeGuardian(userId, id);
        res.status(200).json({ success: true, message: 'Guardian removed successfully.' });
    }
    catch (err) {
        next(err);
    }
}
// ─── Travel Memories ─────────────────────────────────────────────────────────
async function createMemory(req, res, next) {
    try {
        const userId = req.user.id;
        const validated = trust_schemas_1.createMemorySchema.parse(req.body);
        const memory = await trust_service_1.trustService.createMemory(userId, validated);
        res.status(201).json({ success: true, data: memory });
    }
    catch (err) {
        next(err);
    }
}
async function listMemories(req, res, next) {
    try {
        const viewerId = req.user.id;
        const { userId } = req.params;
        const { limit, cursor } = trust_schemas_1.paginationSchema.parse(req.query);
        const result = await trust_service_1.trustService.listMemories(userId, viewerId, { limit, cursor });
        res.status(200).json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
}
async function updateMemory(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const validated = trust_schemas_1.updateMemorySchema.parse(req.body);
        const updated = await trust_service_1.trustService.updateMemory(userId, id, validated);
        res.status(200).json({ success: true, data: updated });
    }
    catch (err) {
        next(err);
    }
}
async function deleteMemory(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        await trust_service_1.trustService.deleteMemory(userId, id);
        res.status(200).json({ success: true, message: 'Memory deleted successfully.' });
    }
    catch (err) {
        next(err);
    }
}
