import { prisma } from '../../core/db';
import { SplitMethod, SettlementStatus, Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient | typeof prisma;

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
} as const;

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
} as const;

export class ExpensesRepository {
  // ── Expenses ────────────────────────────────────────────────────────────────

  async createExpense(
    data: {
      tripId: string;
      title: string;
      description?: string | null;
      totalAmount: number;
      currency: string;
      category: string;
      notes?: string | null;
      receiptUrl?: string | null;
      paidById: string;
      paidByName: string;
      splitMethod: SplitMethod;
      date: Date;
    },
    participants: Array<{
      userId: string;
      name: string;
      amount: number;
      percentage?: number;
    }>,
    tx: TxClient = prisma
  ) {
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

  async findExpenseById(id: string, tx: TxClient = prisma) {
    return tx.expense.findUnique({
      where: { id },
      include: expenseInclude,
    });
  }

  async findExpensesByTrip(
    tripId: string,
    options: { category?: string; limit: number; cursor?: string }
  ) {
    const queryOptions: Parameters<typeof prisma.expense.findMany>[0] = {
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

    const items = await prisma.expense.findMany(queryOptions);
    let nextCursor: string | undefined;
    if (items.length > options.limit) {
      nextCursor = items.pop()!.id;
    }
    return { items, nextCursor };
  }

  async updateExpense(
    id: string,
    data: Partial<{
      title: string;
      description: string | null;
      totalAmount: number;
      currency: string;
      category: string;
      notes: string | null;
      receiptUrl: string | null;
      date: Date;
    }>,
    tx: TxClient = prisma
  ) {
    return tx.expense.update({
      where: { id },
      data,
      include: expenseInclude,
    });
  }

  async softDeleteExpense(id: string, tx: TxClient = prisma) {
    return tx.expense.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  // ── Settlement ──────────────────────────────────────────────────────────────

  async createSettlement(
    data: {
      tripId: string;
      debtorId: string;
      debtorName: string;
      creditorId: string;
      creditorName: string;
      amount: number;
      notes?: string | null;
      paymentReference?: string | null;
    },
    tx: TxClient = prisma
  ) {
    return tx.settlement.create({
      data: {
        ...data,
        status: 'pending',
      },
      include: settlementInclude,
    });
  }

  async findSettlementById(id: string, tx: TxClient = prisma) {
    return tx.settlement.findUnique({
      where: { id },
      include: settlementInclude,
    });
  }

  async findSettlementsByTrip(tripId: string, tx: TxClient = prisma) {
    return tx.settlement.findMany({
      where: { tripId },
      orderBy: { createdAt: 'desc' },
      include: settlementInclude,
    });
  }

  async markSettlementCompleted(
    id: string,
    data: { notes?: string | null; paymentReference?: string | null },
    tx: TxClient = prisma
  ) {
    return tx.settlement.update({
      where: { id },
      data: {
        status: 'completed' as SettlementStatus,
        settledAt: new Date(),
        ...data,
      },
      include: settlementInclude,
    });
  }

  // ── Financial Queries ────────────────────────────────────────────────────────

  async getTripsAllActiveExpenses(tripId: string) {
    return prisma.expense.findMany({
      where: { tripId, isDeleted: false },
      include: {
        participants: true,
      },
    });
  }

  async getCompletedSettlements(tripId: string) {
    return prisma.settlement.findMany({
      where: { tripId, status: 'completed' },
    });
  }
}
