"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpensesRepository = void 0;
const db_1 = require("../../core/db");
// ─── Expenses ────────────────────────────────────────────────────────────────
const expenseInclude = {
    paidBy: {
        select: {
            id: true,
            name: true,
            email: true,
            profile: { select: { avatarUrl: true } },
        },
    },
    participants: {
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    profile: { select: { avatarUrl: true } },
                },
            },
        },
    },
};
const settlementInclude = {
    debtor: {
        select: {
            id: true,
            name: true,
            profile: { select: { avatarUrl: true } },
        },
    },
    creditor: {
        select: {
            id: true,
            name: true,
            profile: { select: { avatarUrl: true } },
        },
    },
};
class ExpensesRepository {
    // ── Expenses ────────────────────────────────────────────────────────────────
    async createExpense(data, participants, tx = db_1.prisma) {
        return tx.expense.create({
            data: {
                ...data,
                participants: {
                    create: participants.map((p) => ({
                        userId: p.userId,
                        name: p.name,
                        amount: p.amount,
                        percentage: p.percentage ?? 0,
                    })),
                },
            },
            include: expenseInclude,
        });
    }
    async findExpenseById(id, tx = db_1.prisma) {
        return tx.expense.findUnique({
            where: { id },
            include: expenseInclude,
        });
    }
    async findExpensesByTrip(tripId, options) {
        const queryOptions = {
            where: {
                tripId,
                isDeleted: false,
                ...(options.category ? { category: options.category } : {}),
            },
            take: options.limit + 1,
            orderBy: { date: 'desc' },
            include: expenseInclude,
        };
        if (options.cursor) {
            queryOptions.cursor = { id: options.cursor };
            queryOptions.skip = 1;
        }
        const items = await db_1.prisma.expense.findMany(queryOptions);
        let nextCursor;
        if (items.length > options.limit) {
            nextCursor = items.pop().id;
        }
        return { items, nextCursor };
    }
    async updateExpense(id, data, tx = db_1.prisma) {
        return tx.expense.update({
            where: { id },
            data,
            include: expenseInclude,
        });
    }
    async softDeleteExpense(id, tx = db_1.prisma) {
        return tx.expense.update({
            where: { id },
            data: { isDeleted: true, deletedAt: new Date() },
        });
    }
    // ── Settlement ──────────────────────────────────────────────────────────────
    async createSettlement(data, tx = db_1.prisma) {
        return tx.settlement.create({
            data: {
                ...data,
                status: 'pending',
            },
            include: settlementInclude,
        });
    }
    async findSettlementById(id, tx = db_1.prisma) {
        return tx.settlement.findUnique({
            where: { id },
            include: settlementInclude,
        });
    }
    async findSettlementsByTrip(tripId, tx = db_1.prisma) {
        return tx.settlement.findMany({
            where: { tripId },
            orderBy: { createdAt: 'desc' },
            include: settlementInclude,
        });
    }
    async markSettlementCompleted(id, data, tx = db_1.prisma) {
        return tx.settlement.update({
            where: { id },
            data: {
                status: 'completed',
                settledAt: new Date(),
                ...data,
            },
            include: settlementInclude,
        });
    }
    // ── Financial Queries ────────────────────────────────────────────────────────
    async getTripsAllActiveExpenses(tripId) {
        return db_1.prisma.expense.findMany({
            where: { tripId, isDeleted: false },
            include: {
                participants: true,
            },
        });
    }
    async getCompletedSettlements(tripId) {
        return db_1.prisma.settlement.findMany({
            where: { tripId, status: 'completed' },
        });
    }
}
exports.ExpensesRepository = ExpensesRepository;
