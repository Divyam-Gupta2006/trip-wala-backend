/**
 * Unit Tests – Expenses Utils (Pure Logic)
 *
 * Tests split computation, balance engine, and the minimum-transactions
 * settlement algorithm in complete isolation — no database or HTTP calls.
 */

import { describe, it, expect } from 'vitest';
import {
  computeParticipants,
  minimizeTransactions,
  MemberBalance,
} from '../expenses.utils';
import {
  createEqualExpenseSchema,
  createPercentageExpenseSchema,
  createCustomExpenseSchema,
} from '../expenses.schemas';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMember(userId: string, name: string, netBalance: number): MemberBalance {
  return {
    userId,
    name,
    totalPaid: netBalance > 0 ? netBalance : 0,
    totalOwed: netBalance < 0 ? Math.abs(netBalance) : 0,
    netBalance,
  };
}

// ─── Equal Split ──────────────────────────────────────────────────────────────

describe('computeParticipants – equal split', () => {
  const participants = [
    { userId: 'u1', name: 'Alice' },
    { userId: 'u2', name: 'Bob' },
    { userId: 'u3', name: 'Charlie' },
  ];

  it('divides evenly for clean amounts', () => {
    const result = computeParticipants('equal', 90, participants);
    expect(result).toHaveLength(3);
    expect(result.every((p) => p.amount === 30)).toBe(true);
  });

  it('absorbs rounding difference in the last participant', () => {
    const result = computeParticipants('equal', 10, participants);
    const total = result.reduce((s, p) => s + p.amount, 0);
    expect(Math.abs(total - 10)).toBeLessThan(0.01);
  });

  it('assigns equal percentages for two participants', () => {
    const result = computeParticipants('equal', 100, [
      { userId: 'u1', name: 'A' },
      { userId: 'u2', name: 'B' },
    ]);
    expect(result[0].percentage).toBeCloseTo(50, 2);
    expect(result[1].percentage).toBeCloseTo(50, 2);
  });

  it('amounts sum to totalAmount', () => {
    const result = computeParticipants('equal', 100, [
      { userId: 'u1', name: 'A' },
      { userId: 'u2', name: 'B' },
      { userId: 'u3', name: 'C' },
    ]);
    const sum = result.reduce((s, p) => s + p.amount, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(0.01);
  });
});

// ─── Percentage Split ─────────────────────────────────────────────────────────

describe('computeParticipants – percentage split', () => {
  it('calculates amounts from percentages correctly', () => {
    const result = computeParticipants('percentage', 200, [
      { userId: 'u1', name: 'Alice', percentage: 60 },
      { userId: 'u2', name: 'Bob', percentage: 40 },
    ]);
    expect(result[0].amount).toBeCloseTo(120, 2);
    expect(result[1].amount).toBeCloseTo(80, 2);
  });

  it('preserves percentage values on result', () => {
    const result = computeParticipants('percentage', 100, [
      { userId: 'u1', name: 'A', percentage: 75 },
      { userId: 'u2', name: 'B', percentage: 25 },
    ]);
    expect(result[0].percentage).toBe(75);
    expect(result[1].percentage).toBe(25);
  });

  it('handles unequal 3-way split', () => {
    const result = computeParticipants('percentage', 300, [
      { userId: 'u1', name: 'A', percentage: 50 },
      { userId: 'u2', name: 'B', percentage: 30 },
      { userId: 'u3', name: 'C', percentage: 20 },
    ]);
    expect(result[0].amount).toBeCloseTo(150, 2);
    expect(result[1].amount).toBeCloseTo(90, 2);
    expect(result[2].amount).toBeCloseTo(60, 2);
  });
});

// ─── Custom Split ─────────────────────────────────────────────────────────────

describe('computeParticipants – custom split', () => {
  it('uses provided amounts directly', () => {
    const result = computeParticipants('custom', 200, [
      { userId: 'u1', name: 'Alice', amount: 150 },
      { userId: 'u2', name: 'Bob', amount: 50 },
    ]);
    expect(result[0].amount).toBe(150);
    expect(result[1].amount).toBe(50);
  });

  it('computes percentages from custom amounts', () => {
    const result = computeParticipants('custom', 100, [
      { userId: 'u1', name: 'Alice', amount: 75 },
      { userId: 'u2', name: 'Bob', amount: 25 },
    ]);
    expect(result[0].percentage).toBeCloseTo(75, 2);
    expect(result[1].percentage).toBeCloseTo(25, 2);
  });
});

// ─── Settlement Algorithm ─────────────────────────────────────────────────────

describe('minimizeTransactions', () => {
  it('returns empty array when all balances are zero', () => {
    expect(minimizeTransactions([makeMember('u1', 'Alice', 0), makeMember('u2', 'Bob', 0)])).toHaveLength(0);
  });

  it('produces one transaction for a simple two-person debt', () => {
    const result = minimizeTransactions([makeMember('u1', 'Alice', 50), makeMember('u2', 'Bob', -50)]);
    expect(result).toHaveLength(1);
    expect(result[0].debtorId).toBe('u2');
    expect(result[0].creditorId).toBe('u1');
    expect(result[0].amount).toBe(50);
  });

  it('minimizes to two transactions for three-person scenario', () => {
    // Alice paid 90 for 3 people equally → each owes 30. Alice net: +60, others: -30
    const result = minimizeTransactions([
      makeMember('u1', 'Alice', 60),
      makeMember('u2', 'Bob', -30),
      makeMember('u3', 'Charlie', -30),
    ]);
    expect(result).toHaveLength(2);
    const totalSettled = result.reduce((s, r) => s + r.amount, 0);
    expect(Math.abs(totalSettled - 60)).toBeLessThan(0.01);
  });

  it('handles complex multi-creditor/debtor scenario', () => {
    // Total positive = 150, total negative = 150 → must balance
    const result = minimizeTransactions([
      makeMember('u1', 'Alice', 100),
      makeMember('u2', 'Bob', 50),
      makeMember('u3', 'Charlie', -80),
      makeMember('u4', 'Diana', -70),
    ]);
    const totalOut = result.reduce((s, r) => s + r.amount, 0);
    expect(Math.abs(totalOut - 150)).toBeLessThan(0.01);
    // Greedy algorithm should need at most n-1 transactions
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('handles floating point amounts', () => {
    const result = minimizeTransactions([makeMember('u1', 'Alice', 33.33), makeMember('u2', 'Bob', -33.33)]);
    expect(result[0].amount).toBeCloseTo(33.33, 2);
  });

  it('all creditors are paid fully', () => {
    const result = minimizeTransactions([
      makeMember('u1', 'A', 200),
      makeMember('u2', 'B', -50),
      makeMember('u3', 'C', -100),
      makeMember('u4', 'D', -50),
    ]);
    const paid = result.filter((r) => r.creditorId === 'u1').reduce((s, r) => s + r.amount, 0);
    expect(Math.abs(paid - 200)).toBeLessThan(0.01);
  });

  it('handles single debtor paying multiple creditors', () => {
    const result = minimizeTransactions([
      makeMember('u1', 'Creditor1', 100),
      makeMember('u2', 'Creditor2', 50),
      makeMember('u3', 'Debtor', -150),
    ]);
    const debtorPayments = result.filter((r) => r.debtorId === 'u3');
    const totalPaid = debtorPayments.reduce((s, r) => s + r.amount, 0);
    expect(Math.abs(totalPaid - 150)).toBeLessThan(0.01);
  });
});

// ─── Schema Validation ────────────────────────────────────────────────────────

const uuid1 = '00000000-0000-0000-0000-000000000001';
const uuid2 = '00000000-0000-0000-0000-000000000002';

describe('Zod schema validation – equal', () => {
  it('rejects with fewer than 2 participants', () => {
    const result = createEqualExpenseSchema.safeParse({
      splitMethod: 'equal',
      title: 'Lunch',
      totalAmount: 100,
      currency: 'INR',
      category: 'food',
      paidById: uuid1,
      participants: [{ userId: uuid1, name: 'Alice' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid equal split', () => {
    const result = createEqualExpenseSchema.safeParse({
      splitMethod: 'equal',
      title: 'Dinner',
      totalAmount: 200,
      currency: 'INR',
      category: 'food',
      paidById: uuid1,
      participants: [
        { userId: uuid1, name: 'Alice' },
        { userId: uuid2, name: 'Bob' },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('Zod schema validation – percentage', () => {
  it('rejects when percentages do not sum to 100', () => {
    const result = createPercentageExpenseSchema.safeParse({
      splitMethod: 'percentage',
      title: 'Hotel',
      totalAmount: 500,
      currency: 'INR',
      category: 'accommodation',
      paidById: uuid1,
      participants: [
        { userId: uuid1, name: 'Alice', percentage: 60 },
        { userId: uuid2, name: 'Bob', percentage: 30 }, // 90% only
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid 100% total', () => {
    const result = createPercentageExpenseSchema.safeParse({
      splitMethod: 'percentage',
      title: 'Hotel',
      totalAmount: 500,
      currency: 'INR',
      category: 'accommodation',
      paidById: uuid1,
      participants: [
        { userId: uuid1, name: 'Alice', percentage: 60 },
        { userId: uuid2, name: 'Bob', percentage: 40 },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('Zod schema validation – custom', () => {
  it('rejects when amounts do not sum to totalAmount', () => {
    const result = createCustomExpenseSchema.safeParse({
      splitMethod: 'custom',
      title: 'Transport',
      totalAmount: 300,
      currency: 'INR',
      category: 'transport',
      paidById: uuid1,
      participants: [
        { userId: uuid1, name: 'Alice', amount: 100 },
        { userId: uuid2, name: 'Bob', amount: 150 }, // 250 ≠ 300
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid custom split', () => {
    const result = createCustomExpenseSchema.safeParse({
      splitMethod: 'custom',
      title: 'Transport',
      totalAmount: 300,
      currency: 'INR',
      category: 'transport',
      paidById: uuid1,
      participants: [
        { userId: uuid1, name: 'Alice', amount: 200 },
        { userId: uuid2, name: 'Bob', amount: 100 },
      ],
    });
    expect(result.success).toBe(true);
  });
});
