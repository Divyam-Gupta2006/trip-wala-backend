"use strict";
/**
 * Unit Tests – Expenses Utils (Pure Logic)
 *
 * Tests split computation, balance engine, and the minimum-transactions
 * settlement algorithm in complete isolation — no database or HTTP calls.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const expenses_utils_1 = require("../expenses.utils");
const expenses_schemas_1 = require("../expenses.schemas");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeMember(userId, name, netBalance) {
    return {
        userId,
        name,
        totalPaid: netBalance > 0 ? netBalance : 0,
        totalOwed: netBalance < 0 ? Math.abs(netBalance) : 0,
        netBalance,
    };
}
// ─── Equal Split ──────────────────────────────────────────────────────────────
(0, vitest_1.describe)('computeParticipants – equal split', () => {
    const participants = [
        { userId: 'u1', name: 'Alice' },
        { userId: 'u2', name: 'Bob' },
        { userId: 'u3', name: 'Charlie' },
    ];
    (0, vitest_1.it)('divides evenly for clean amounts', () => {
        const result = (0, expenses_utils_1.computeParticipants)('equal', 90, participants);
        (0, vitest_1.expect)(result).toHaveLength(3);
        (0, vitest_1.expect)(result.every((p) => p.amount === 30)).toBe(true);
    });
    (0, vitest_1.it)('absorbs rounding difference in the last participant', () => {
        const result = (0, expenses_utils_1.computeParticipants)('equal', 10, participants);
        const total = result.reduce((s, p) => s + p.amount, 0);
        (0, vitest_1.expect)(Math.abs(total - 10)).toBeLessThan(0.01);
    });
    (0, vitest_1.it)('assigns equal percentages for two participants', () => {
        const result = (0, expenses_utils_1.computeParticipants)('equal', 100, [
            { userId: 'u1', name: 'A' },
            { userId: 'u2', name: 'B' },
        ]);
        (0, vitest_1.expect)(result[0].percentage).toBeCloseTo(50, 2);
        (0, vitest_1.expect)(result[1].percentage).toBeCloseTo(50, 2);
    });
    (0, vitest_1.it)('amounts sum to totalAmount', () => {
        const result = (0, expenses_utils_1.computeParticipants)('equal', 100, [
            { userId: 'u1', name: 'A' },
            { userId: 'u2', name: 'B' },
            { userId: 'u3', name: 'C' },
        ]);
        const sum = result.reduce((s, p) => s + p.amount, 0);
        (0, vitest_1.expect)(Math.abs(sum - 100)).toBeLessThan(0.01);
    });
});
// ─── Percentage Split ─────────────────────────────────────────────────────────
(0, vitest_1.describe)('computeParticipants – percentage split', () => {
    (0, vitest_1.it)('calculates amounts from percentages correctly', () => {
        const result = (0, expenses_utils_1.computeParticipants)('percentage', 200, [
            { userId: 'u1', name: 'Alice', percentage: 60 },
            { userId: 'u2', name: 'Bob', percentage: 40 },
        ]);
        (0, vitest_1.expect)(result[0].amount).toBeCloseTo(120, 2);
        (0, vitest_1.expect)(result[1].amount).toBeCloseTo(80, 2);
    });
    (0, vitest_1.it)('preserves percentage values on result', () => {
        const result = (0, expenses_utils_1.computeParticipants)('percentage', 100, [
            { userId: 'u1', name: 'A', percentage: 75 },
            { userId: 'u2', name: 'B', percentage: 25 },
        ]);
        (0, vitest_1.expect)(result[0].percentage).toBe(75);
        (0, vitest_1.expect)(result[1].percentage).toBe(25);
    });
    (0, vitest_1.it)('handles unequal 3-way split', () => {
        const result = (0, expenses_utils_1.computeParticipants)('percentage', 300, [
            { userId: 'u1', name: 'A', percentage: 50 },
            { userId: 'u2', name: 'B', percentage: 30 },
            { userId: 'u3', name: 'C', percentage: 20 },
        ]);
        (0, vitest_1.expect)(result[0].amount).toBeCloseTo(150, 2);
        (0, vitest_1.expect)(result[1].amount).toBeCloseTo(90, 2);
        (0, vitest_1.expect)(result[2].amount).toBeCloseTo(60, 2);
    });
});
// ─── Custom Split ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)('computeParticipants – custom split', () => {
    (0, vitest_1.it)('uses provided amounts directly', () => {
        const result = (0, expenses_utils_1.computeParticipants)('custom', 200, [
            { userId: 'u1', name: 'Alice', amount: 150 },
            { userId: 'u2', name: 'Bob', amount: 50 },
        ]);
        (0, vitest_1.expect)(result[0].amount).toBe(150);
        (0, vitest_1.expect)(result[1].amount).toBe(50);
    });
    (0, vitest_1.it)('computes percentages from custom amounts', () => {
        const result = (0, expenses_utils_1.computeParticipants)('custom', 100, [
            { userId: 'u1', name: 'Alice', amount: 75 },
            { userId: 'u2', name: 'Bob', amount: 25 },
        ]);
        (0, vitest_1.expect)(result[0].percentage).toBeCloseTo(75, 2);
        (0, vitest_1.expect)(result[1].percentage).toBeCloseTo(25, 2);
    });
});
// ─── Settlement Algorithm ─────────────────────────────────────────────────────
(0, vitest_1.describe)('minimizeTransactions', () => {
    (0, vitest_1.it)('returns empty array when all balances are zero', () => {
        (0, vitest_1.expect)((0, expenses_utils_1.minimizeTransactions)([makeMember('u1', 'Alice', 0), makeMember('u2', 'Bob', 0)])).toHaveLength(0);
    });
    (0, vitest_1.it)('produces one transaction for a simple two-person debt', () => {
        const result = (0, expenses_utils_1.minimizeTransactions)([makeMember('u1', 'Alice', 50), makeMember('u2', 'Bob', -50)]);
        (0, vitest_1.expect)(result).toHaveLength(1);
        (0, vitest_1.expect)(result[0].debtorId).toBe('u2');
        (0, vitest_1.expect)(result[0].creditorId).toBe('u1');
        (0, vitest_1.expect)(result[0].amount).toBe(50);
    });
    (0, vitest_1.it)('minimizes to two transactions for three-person scenario', () => {
        // Alice paid 90 for 3 people equally → each owes 30. Alice net: +60, others: -30
        const result = (0, expenses_utils_1.minimizeTransactions)([
            makeMember('u1', 'Alice', 60),
            makeMember('u2', 'Bob', -30),
            makeMember('u3', 'Charlie', -30),
        ]);
        (0, vitest_1.expect)(result).toHaveLength(2);
        const totalSettled = result.reduce((s, r) => s + r.amount, 0);
        (0, vitest_1.expect)(Math.abs(totalSettled - 60)).toBeLessThan(0.01);
    });
    (0, vitest_1.it)('handles complex multi-creditor/debtor scenario', () => {
        // Total positive = 150, total negative = 150 → must balance
        const result = (0, expenses_utils_1.minimizeTransactions)([
            makeMember('u1', 'Alice', 100),
            makeMember('u2', 'Bob', 50),
            makeMember('u3', 'Charlie', -80),
            makeMember('u4', 'Diana', -70),
        ]);
        const totalOut = result.reduce((s, r) => s + r.amount, 0);
        (0, vitest_1.expect)(Math.abs(totalOut - 150)).toBeLessThan(0.01);
        // Greedy algorithm should need at most n-1 transactions
        (0, vitest_1.expect)(result.length).toBeLessThanOrEqual(3);
    });
    (0, vitest_1.it)('handles floating point amounts', () => {
        const result = (0, expenses_utils_1.minimizeTransactions)([makeMember('u1', 'Alice', 33.33), makeMember('u2', 'Bob', -33.33)]);
        (0, vitest_1.expect)(result[0].amount).toBeCloseTo(33.33, 2);
    });
    (0, vitest_1.it)('all creditors are paid fully', () => {
        const result = (0, expenses_utils_1.minimizeTransactions)([
            makeMember('u1', 'A', 200),
            makeMember('u2', 'B', -50),
            makeMember('u3', 'C', -100),
            makeMember('u4', 'D', -50),
        ]);
        const paid = result.filter((r) => r.creditorId === 'u1').reduce((s, r) => s + r.amount, 0);
        (0, vitest_1.expect)(Math.abs(paid - 200)).toBeLessThan(0.01);
    });
    (0, vitest_1.it)('handles single debtor paying multiple creditors', () => {
        const result = (0, expenses_utils_1.minimizeTransactions)([
            makeMember('u1', 'Creditor1', 100),
            makeMember('u2', 'Creditor2', 50),
            makeMember('u3', 'Debtor', -150),
        ]);
        const debtorPayments = result.filter((r) => r.debtorId === 'u3');
        const totalPaid = debtorPayments.reduce((s, r) => s + r.amount, 0);
        (0, vitest_1.expect)(Math.abs(totalPaid - 150)).toBeLessThan(0.01);
    });
});
// ─── Schema Validation ────────────────────────────────────────────────────────
const uuid1 = '00000000-0000-0000-0000-000000000001';
const uuid2 = '00000000-0000-0000-0000-000000000002';
(0, vitest_1.describe)('Zod schema validation – equal', () => {
    (0, vitest_1.it)('rejects with fewer than 2 participants', () => {
        const result = expenses_schemas_1.createEqualExpenseSchema.safeParse({
            splitMethod: 'equal',
            title: 'Lunch',
            totalAmount: 100,
            currency: 'INR',
            category: 'food',
            paidById: uuid1,
            participants: [{ userId: uuid1, name: 'Alice' }],
        });
        (0, vitest_1.expect)(result.success).toBe(false);
    });
    (0, vitest_1.it)('accepts valid equal split', () => {
        const result = expenses_schemas_1.createEqualExpenseSchema.safeParse({
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
        (0, vitest_1.expect)(result.success).toBe(true);
    });
});
(0, vitest_1.describe)('Zod schema validation – percentage', () => {
    (0, vitest_1.it)('rejects when percentages do not sum to 100', () => {
        const result = expenses_schemas_1.createPercentageExpenseSchema.safeParse({
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
        (0, vitest_1.expect)(result.success).toBe(false);
    });
    (0, vitest_1.it)('accepts valid 100% total', () => {
        const result = expenses_schemas_1.createPercentageExpenseSchema.safeParse({
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
        (0, vitest_1.expect)(result.success).toBe(true);
    });
});
(0, vitest_1.describe)('Zod schema validation – custom', () => {
    (0, vitest_1.it)('rejects when amounts do not sum to totalAmount', () => {
        const result = expenses_schemas_1.createCustomExpenseSchema.safeParse({
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
        (0, vitest_1.expect)(result.success).toBe(false);
    });
    (0, vitest_1.it)('accepts valid custom split', () => {
        const result = expenses_schemas_1.createCustomExpenseSchema.safeParse({
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
        (0, vitest_1.expect)(result.success).toBe(true);
    });
});
