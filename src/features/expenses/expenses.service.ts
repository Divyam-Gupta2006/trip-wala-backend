import { prisma } from '../../core/db';
import { SplitMethod } from '@prisma/client';
import { ExpensesRepository } from './expenses.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { ApiError } from '../../core/errors';
import {
  computeParticipants,
  minimizeTransactions,
  ParticipantInput,
} from './expenses.utils';

export type { MemberBalance, SuggestedSettlement } from './expenses.utils';
import type { MemberBalance, SuggestedSettlement } from './expenses.utils';

const repo = new ExpensesRepository();
const notifService = new NotificationsService();

// ─── Types ────────────────────────────────────────────────────────────────────

type CreateExpenseInput = {
  splitMethod: 'equal' | 'percentage' | 'custom';
  title: string;
  description?: string | null;
  totalAmount: number;
  currency: string;
  category: string;
  notes?: string | null;
  receiptUrl?: string | null;
  paidById: string;
  date: Date;
  participants: ParticipantInput[];
};

// ─── Service ──────────────────────────────────────────────────────────────────

export class ExpensesService {
  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async assertTripMember(tripId: string, userId: string) {
    const member = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    if (!member) {
      throw new ApiError(403, 'NOT_TRIP_MEMBER', 'You must be a trip member to perform this action.');
    }
    return member;
  }

  private async assertTripExists(tripId: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { members: { include: { user: { select: { id: true, name: true } } } } },
    });
    if (!trip || trip.isDeleted) {
      throw new ApiError(404, 'TRIP_NOT_FOUND', 'Trip not found.');
    }
    return trip;
  }

  // ─── Expenses ────────────────────────────────────────────────────────────────

  async createExpense(tripId: string, actorId: string, input: CreateExpenseInput) {
    const trip = await this.assertTripExists(tripId);
    await this.assertTripMember(tripId, actorId);

    const payerMember = trip.members.find((m) => m.userId === input.paidById);
    if (!payerMember) {
      throw new ApiError(400, 'INVALID_PAYER', 'The payer must be a trip member.');
    }

    const memberIds = new Set(trip.members.map((m) => m.userId));
    for (const p of input.participants) {
      if (!memberIds.has(p.userId)) {
        throw new ApiError(400, 'INVALID_PARTICIPANT', `User ${p.userId} is not a member of this trip.`);
      }
    }

    const computedParticipants = computeParticipants(
      input.splitMethod as SplitMethod,
      input.totalAmount,
      input.participants
    );

    const expense = await repo.createExpense(
      {
        tripId,
        title: input.title,
        description: input.description,
        totalAmount: input.totalAmount,
        currency: input.currency,
        category: input.category,
        notes: input.notes,
        receiptUrl: input.receiptUrl,
        paidById: input.paidById,
        paidByName: payerMember.user.name,
        splitMethod: input.splitMethod as SplitMethod,
        date: input.date,
      },
      computedParticipants
    );

    // Notify all trip members (except the creator)
    const notifTargets = trip.members.filter((m) => m.userId !== actorId);
    await Promise.all(
      notifTargets.map((m) =>
        notifService.publish({
          userId: m.userId,
          actorId,
          type: 'expense_created',
          title: 'New Trip Expense',
          body: `"${input.title}" (${input.currency} ${input.totalAmount}) was added to the trip.`,
          relatedEntityId: tripId,
          relatedEntityType: 'trip',
          metadata: { expenseId: expense.id, tripId },
        }).catch(() => {})
      )
    );

    return expense;
  }

  async getExpense(tripId: string, expenseId: string, userId: string) {
    await this.assertTripMember(tripId, userId);
    const expense = await repo.findExpenseById(expenseId);
    if (!expense || expense.isDeleted || expense.tripId !== tripId) {
      throw new ApiError(404, 'EXPENSE_NOT_FOUND', 'Expense not found.');
    }
    return expense;
  }

  async listExpenses(tripId: string, userId: string, options: { category?: string; limit: number; cursor?: string }) {
    await this.assertTripMember(tripId, userId);
    return repo.findExpensesByTrip(tripId, options);
  }

  async updateExpense(tripId: string, expenseId: string, actorId: string, updates: any) {
    await this.assertTripMember(tripId, actorId);
    const expense = await repo.findExpenseById(expenseId);
    if (!expense || expense.isDeleted || expense.tripId !== tripId) {
      throw new ApiError(404, 'EXPENSE_NOT_FOUND', 'Expense not found.');
    }

    const member = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: actorId } },
    });
    const isOrganizer = member?.role === 'organizer' || member?.role === 'coOrganizer';
    if (expense.paidById !== actorId && !isOrganizer) {
      throw new ApiError(403, 'FORBIDDEN', 'Only the expense creator or trip organizers can edit this expense.');
    }

    const updated = await repo.updateExpense(expenseId, updates);

    const trip = await this.assertTripExists(tripId);
    await Promise.all(
      trip.members
        .filter((m) => m.userId !== actorId)
        .map((m) =>
          notifService.publish({
            userId: m.userId,
            actorId,
            type: 'expense_updated',
            title: 'Expense Updated',
            body: `The expense "${expense.title}" was updated.`,
            relatedEntityId: tripId,
            relatedEntityType: 'trip',
            metadata: { expenseId, tripId },
          }).catch(() => {})
        )
    );

    return updated;
  }

  async deleteExpense(tripId: string, expenseId: string, actorId: string) {
    await this.assertTripMember(tripId, actorId);
    const expense = await repo.findExpenseById(expenseId);
    if (!expense || expense.isDeleted || expense.tripId !== tripId) {
      throw new ApiError(404, 'EXPENSE_NOT_FOUND', 'Expense not found.');
    }

    const member = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: actorId } },
    });
    const isOrganizer = member?.role === 'organizer' || member?.role === 'coOrganizer';
    if (expense.paidById !== actorId && !isOrganizer) {
      throw new ApiError(403, 'FORBIDDEN', 'Only the expense creator or trip organizers can delete this expense.');
    }

    await repo.softDeleteExpense(expenseId);

    const trip = await this.assertTripExists(tripId);
    await Promise.all(
      trip.members
        .filter((m) => m.userId !== actorId)
        .map((m) =>
          notifService.publish({
            userId: m.userId,
            actorId,
            type: 'expense_deleted',
            title: 'Expense Removed',
            body: `The expense "${expense.title}" was removed from the trip.`,
            relatedEntityId: tripId,
            relatedEntityType: 'trip',
            metadata: { expenseId, tripId },
          }).catch(() => {})
        )
    );
  }

  // ─── Balance Calculation ─────────────────────────────────────────────────────

  async calculateBalances(tripId: string, userId: string): Promise<{
    balances: MemberBalance[];
    suggestions: SuggestedSettlement[];
  }> {
    await this.assertTripMember(tripId, userId);
    const trip = await this.assertTripExists(tripId);
    const expenses = await repo.getTripsAllActiveExpenses(tripId);
    const completedSettlements = await repo.getCompletedSettlements(tripId);

    // Initialize balances for all current members
    const balanceMap = new Map<string, MemberBalance>();
    for (const member of trip.members) {
      balanceMap.set(member.userId, {
        userId: member.userId,
        name: member.user.name,
        totalPaid: 0,
        totalOwed: 0,
        netBalance: 0,
      });
    }

    // Credit payer, charge participants
    for (const expense of expenses) {
      const payer = balanceMap.get(expense.paidById);
      if (payer) payer.totalPaid += expense.totalAmount;

      for (const participant of expense.participants) {
        const entry = balanceMap.get(participant.userId);
        if (entry) entry.totalOwed += participant.amount;
      }
    }

    // Apply completed settlements (debtor "paid back", creditor "received")
    for (const settlement of completedSettlements) {
      const debtor = balanceMap.get(settlement.debtorId);
      const creditor = balanceMap.get(settlement.creditorId);
      if (debtor) debtor.totalPaid += settlement.amount;
      if (creditor) creditor.totalOwed += settlement.amount;
    }

    // Compute net balance and round
    for (const entry of balanceMap.values()) {
      entry.netBalance = parseFloat((entry.totalPaid - entry.totalOwed).toFixed(2));
      entry.totalPaid = parseFloat(entry.totalPaid.toFixed(2));
      entry.totalOwed = parseFloat(entry.totalOwed.toFixed(2));
    }

    const balances = Array.from(balanceMap.values());
    const suggestions = minimizeTransactions(balances);

    return { balances, suggestions };
  }

  // ─── Settlements ─────────────────────────────────────────────────────────────

  async recordSettlement(
    tripId: string,
    actorId: string,
    data: { debtorId: string; creditorId: string; amount: number; notes?: string; paymentReference?: string }
  ) {
    await this.assertTripMember(tripId, actorId);
    await this.assertTripExists(tripId);

    const member = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: actorId } },
    });
    const isOrganizer = member?.role === 'organizer' || member?.role === 'coOrganizer';
    if (actorId !== data.debtorId && !isOrganizer) {
      throw new ApiError(403, 'FORBIDDEN', 'Only the debtor or trip organizers can record a settlement.');
    }

    const [debtorUser, creditorUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: data.debtorId }, select: { id: true, name: true } }),
      prisma.user.findUnique({ where: { id: data.creditorId }, select: { id: true, name: true } }),
    ]);

    if (!debtorUser || !creditorUser) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Debtor or creditor not found.');
    }

    const settlement = await repo.createSettlement({
      tripId,
      debtorId: data.debtorId,
      debtorName: debtorUser.name,
      creditorId: data.creditorId,
      creditorName: creditorUser.name,
      amount: data.amount,
      notes: data.notes,
      paymentReference: data.paymentReference,
    });

    notifService.publish({
      userId: data.creditorId,
      actorId,
      type: 'settlement_requested',
      title: 'Settlement Recorded',
      body: `${debtorUser.name} has recorded a payment of ${data.amount} to you.`,
      relatedEntityId: tripId,
      relatedEntityType: 'trip',
      metadata: { settlementId: settlement.id, tripId },
    }).catch(() => {});

    return settlement;
  }

  async markSettled(
    tripId: string,
    settlementId: string,
    actorId: string,
    data: { notes?: string; paymentReference?: string }
  ) {
    await this.assertTripMember(tripId, actorId);
    const settlement = await repo.findSettlementById(settlementId);
    if (!settlement || settlement.tripId !== tripId) {
      throw new ApiError(404, 'SETTLEMENT_NOT_FOUND', 'Settlement not found.');
    }
    if (settlement.status === 'completed') {
      throw new ApiError(400, 'ALREADY_SETTLED', 'This settlement is already marked as completed.');
    }

    const member = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: actorId } },
    });
    const isOrganizer = member?.role === 'organizer' || member?.role === 'coOrganizer';
    if (actorId !== settlement.creditorId && !isOrganizer) {
      throw new ApiError(403, 'FORBIDDEN', 'Only the creditor or trip organizers can confirm a settlement.');
    }

    const updated = await repo.markSettlementCompleted(settlementId, data);

    notifService.publish({
      userId: settlement.debtorId,
      actorId,
      type: 'settlement_completed',
      title: 'Payment Confirmed',
      body: `${settlement.creditorName} has confirmed your payment of ${settlement.amount}.`,
      relatedEntityId: tripId,
      relatedEntityType: 'trip',
      metadata: { settlementId, tripId },
    }).catch(() => {});

    return updated;
  }

  async listSettlements(tripId: string, userId: string) {
    await this.assertTripMember(tripId, userId);
    return repo.findSettlementsByTrip(tripId);
  }

  // ─── Financial Summary ────────────────────────────────────────────────────────

  async getFinancialSummary(tripId: string, userId: string) {
    const { balances } = await this.calculateBalances(tripId, userId);
    const expenses = await repo.getTripsAllActiveExpenses(tripId);
    const settlements = await repo.findSettlementsByTrip(tripId);

    const totalExpenses = parseFloat(expenses.reduce((sum, e) => sum + e.totalAmount, 0).toFixed(2));

    return {
      totalExpenses,
      expenseCount: expenses.length,
      memberBalances: balances,
      settlements: {
        total: settlements.length,
        outstanding: settlements.filter((s) => s.status === 'pending').length,
        completed: settlements.filter((s) => s.status === 'completed').length,
      },
    };
  }
}
