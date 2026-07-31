"use strict";
/**
 * Pure expense calculation utilities.
 * No database dependencies — safe to unit test in isolation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeParticipants = computeParticipants;
exports.minimizeTransactions = minimizeTransactions;
// ─── Split Computation ────────────────────────────────────────────────────────
function computeParticipants(splitMethod, totalAmount, rawParticipants) {
    switch (splitMethod) {
        case 'equal': {
            const share = parseFloat((totalAmount / rawParticipants.length).toFixed(2));
            const baseTotal = share * (rawParticipants.length - 1);
            return rawParticipants.map((p, i) => ({
                userId: p.userId,
                name: p.name,
                // Last participant absorbs rounding difference
                amount: i === rawParticipants.length - 1
                    ? parseFloat((totalAmount - baseTotal).toFixed(2))
                    : share,
                percentage: parseFloat((100 / rawParticipants.length).toFixed(4)),
            }));
        }
        case 'percentage': {
            return rawParticipants.map((p) => ({
                userId: p.userId,
                name: p.name,
                amount: parseFloat((((p.percentage ?? 0) / 100) * totalAmount).toFixed(2)),
                percentage: p.percentage ?? 0,
            }));
        }
        case 'custom': {
            return rawParticipants.map((p) => ({
                userId: p.userId,
                name: p.name,
                amount: p.amount ?? 0,
                percentage: parseFloat((((p.amount ?? 0) / totalAmount) * 100).toFixed(4)),
            }));
        }
    }
}
// ─── Minimum Transactions Algorithm ──────────────────────────────────────────
//
// Greedy debt simplification.
// Steps:
//   1. Separate balances into creditors (net > 0) and debtors (net < 0).
//   2. Sort both lists in descending order of absolute value.
//   3. Match largest debtor to largest creditor; generate a payment for
//      min(debtor.balance, creditor.balance).
//   4. Advance whichever side is exhausted and repeat.
//
// Time complexity: O(n log n) — sufficient for any real trip size.
function minimizeTransactions(balances) {
    const creditors = balances
        .filter((b) => b.netBalance > 0.01)
        .map((b) => ({ ...b, remaining: b.netBalance }))
        .sort((a, b) => b.remaining - a.remaining);
    const debtors = balances
        .filter((b) => b.netBalance < -0.01)
        .map((b) => ({ ...b, remaining: Math.abs(b.netBalance) }))
        .sort((a, b) => b.remaining - a.remaining);
    const suggestions = [];
    let ci = 0;
    let di = 0;
    while (ci < creditors.length && di < debtors.length) {
        const creditor = creditors[ci];
        const debtor = debtors[di];
        const amount = parseFloat(Math.min(creditor.remaining, debtor.remaining).toFixed(2));
        if (amount > 0.01) {
            suggestions.push({
                debtorId: debtor.userId,
                debtorName: debtor.name,
                creditorId: creditor.userId,
                creditorName: creditor.name,
                amount,
            });
        }
        creditor.remaining -= amount;
        debtor.remaining -= amount;
        if (creditor.remaining < 0.01)
            ci++;
        if (debtor.remaining < 0.01)
            di++;
    }
    return suggestions;
}
