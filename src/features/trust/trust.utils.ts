/**
 * Pure Trust Score computation.
 * Mirrors the Flutter TrustServiceImpl algorithm exactly.
 * No database dependencies — safe to unit test in isolation.
 */

// ─── Trust Factor Weights ─────────────────────────────────────────────────────
// Changing weights here propagates to all calculations automatically.

export const TRUST_WEIGHTS = {
  base: 30,
  phoneVerified: 15,
  governmentIdVerified: 25,
  socialAccounts: 10,    // at least one social account linked
  completedTripMax: 10,  // capped contribution from trips
  completedTripPer: 2,   // points per completed trip
  ratingsMax: 10,        // capped rating contribution
  ratingsDefault: 8,     // default if no ratings yet
  memoriesMax: 6,        // capped memories contribution
  memoriesPer: 2,        // points per travel memory
  guardiansAdded: 10,    // at least one guardian
  max: 100,
} as const;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface TrustFactors {
  isPhoneVerified: boolean;
  isGovernmentIdVerified: boolean;
  socialAccountCount: number;
  completedTripCount: number;
  averageRating: number | null; // null = no ratings yet
  memoryCount: number;
  guardianCount: number;
}

export interface TrustBreakdown {
  score: number;
  factors: {
    base: number;
    phoneVerified: number;
    governmentIdVerified: number;
    socialAccounts: number;
    completedTrips: number;
    ratings: number;
    memories: number;
    guardians: number;
  };
}

// ─── Algorithm ────────────────────────────────────────────────────────────────

export function computeTrustScore(factors: TrustFactors): TrustBreakdown {
  const w = TRUST_WEIGHTS;

  const base = w.base;
  const phoneVerified = factors.isPhoneVerified ? w.phoneVerified : 0;
  const governmentIdVerified = factors.isGovernmentIdVerified ? w.governmentIdVerified : 0;
  const socialAccounts = factors.socialAccountCount >= 1 ? w.socialAccounts : 0;
  const completedTrips = Math.min(w.completedTripMax, factors.completedTripCount * w.completedTripPer);
  const memories = Math.min(w.memoriesMax, factors.memoryCount * w.memoriesPer);
  const guardians = factors.guardianCount >= 1 ? w.guardiansAdded : 0;

  let ratings: number;
  if (factors.averageRating === null) {
    ratings = w.ratingsDefault; // no ratings yet — benefit of the doubt
  } else {
    ratings = Math.round((factors.averageRating / 5.0) * w.ratingsMax);
  }

  const raw = base + phoneVerified + governmentIdVerified + socialAccounts + completedTrips + ratings + memories + guardians;
  const score = Math.min(w.max, raw);

  return {
    score,
    factors: { base, phoneVerified, governmentIdVerified, socialAccounts, completedTrips, ratings, memories, guardians },
  };
}
