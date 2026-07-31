"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const trust_utils_1 = require("../trust.utils");
(0, vitest_1.describe)('Trust Score Calculation', () => {
    (0, vitest_1.it)('should return base score of 30 when all inputs are empty/unverified', () => {
        const res = (0, trust_utils_1.computeTrustScore)({
            isPhoneVerified: false,
            isGovernmentIdVerified: false,
            socialAccountCount: 0,
            completedTripCount: 0,
            averageRating: null,
            memoryCount: 0,
            guardianCount: 0,
        });
        (0, vitest_1.expect)(res.score).toBe(38); // 30 base + 8 default ratings points
        (0, vitest_1.expect)(res.factors.base).toBe(30);
        (0, vitest_1.expect)(res.factors.ratings).toBe(8);
        (0, vitest_1.expect)(res.factors.phoneVerified).toBe(0);
        (0, vitest_1.expect)(res.factors.governmentIdVerified).toBe(0);
    });
    (0, vitest_1.it)('should apply phone verification (+15) and government ID verification (+25)', () => {
        const res = (0, trust_utils_1.computeTrustScore)({
            isPhoneVerified: true,
            isGovernmentIdVerified: true,
            socialAccountCount: 0,
            completedTripCount: 0,
            averageRating: null,
            memoryCount: 0,
            guardianCount: 0,
        });
        (0, vitest_1.expect)(res.score).toBe(78); // 30 + 15 + 25 + 8
    });
    (0, vitest_1.it)('should apply social accounts (+10) and guardian setup (+10)', () => {
        const res = (0, trust_utils_1.computeTrustScore)({
            isPhoneVerified: false,
            isGovernmentIdVerified: false,
            socialAccountCount: 1,
            completedTripCount: 0,
            averageRating: null,
            memoryCount: 0,
            guardianCount: 2,
        });
        (0, vitest_1.expect)(res.score).toBe(58); // 30 + 8 + 10 (social) + 10 (guardians)
    });
    (0, vitest_1.it)('should cap completed trips contribution at +10 (2 points per trip)', () => {
        const res1 = (0, trust_utils_1.computeTrustScore)({
            isPhoneVerified: false,
            isGovernmentIdVerified: false,
            socialAccountCount: 0,
            completedTripCount: 3,
            averageRating: null,
            memoryCount: 0,
            guardianCount: 0,
        });
        (0, vitest_1.expect)(res1.factors.completedTrips).toBe(6);
        const res2 = (0, trust_utils_1.computeTrustScore)({
            isPhoneVerified: false,
            isGovernmentIdVerified: false,
            socialAccountCount: 0,
            completedTripCount: 7, // 7 * 2 = 14, capped at 10
            averageRating: null,
            memoryCount: 0,
            guardianCount: 0,
        });
        (0, vitest_1.expect)(res2.factors.completedTrips).toBe(10);
    });
    (0, vitest_1.it)('should cap travel memories contribution at +6 (2 points per memory)', () => {
        const res1 = (0, trust_utils_1.computeTrustScore)({
            isPhoneVerified: false,
            isGovernmentIdVerified: false,
            socialAccountCount: 0,
            completedTripCount: 0,
            averageRating: null,
            memoryCount: 2,
            guardianCount: 0,
        });
        (0, vitest_1.expect)(res1.factors.memories).toBe(4);
        const res2 = (0, trust_utils_1.computeTrustScore)({
            isPhoneVerified: false,
            isGovernmentIdVerified: false,
            socialAccountCount: 0,
            completedTripCount: 0,
            averageRating: null,
            memoryCount: 5, // 5 * 2 = 10, capped at 6
            guardianCount: 0,
        });
        (0, vitest_1.expect)(res2.factors.memories).toBe(6);
    });
    (0, vitest_1.it)('should calculate ratings points based on average rating', () => {
        const res1 = (0, trust_utils_1.computeTrustScore)({
            isPhoneVerified: false,
            isGovernmentIdVerified: false,
            socialAccountCount: 0,
            completedTripCount: 0,
            averageRating: 5.0, // (5.0 / 5.0) * 10 = 10
            memoryCount: 0,
            guardianCount: 0,
        });
        (0, vitest_1.expect)(res1.factors.ratings).toBe(10);
        const res2 = (0, trust_utils_1.computeTrustScore)({
            isPhoneVerified: false,
            isGovernmentIdVerified: false,
            socialAccountCount: 0,
            completedTripCount: 0,
            averageRating: 3.5, // (3.5 / 5.0) * 10 = 7
            memoryCount: 0,
            guardianCount: 0,
        });
        (0, vitest_1.expect)(res2.factors.ratings).toBe(7);
    });
    (0, vitest_1.it)('should cap overall score at 100', () => {
        const res = (0, trust_utils_1.computeTrustScore)({
            isPhoneVerified: true, // +15
            isGovernmentIdVerified: true, // +25
            socialAccountCount: 2, // +10
            completedTripCount: 10, // +10
            averageRating: 5.0, // +10
            memoryCount: 5, // +6
            guardianCount: 2, // +10
        });
        // 30 base + 15 + 25 + 10 + 10 + 10 + 6 + 10 = 116, capped at 100
        (0, vitest_1.expect)(res.score).toBe(100);
    });
});
