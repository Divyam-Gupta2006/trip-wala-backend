import { Request, Response, NextFunction } from 'express';
import { ExpensesService } from './expenses.service';
import {
  createExpenseSchema,
  updateExpenseSchema,
  recordSettlementSchema,
  markSettledSchema,
  expenseQuerySchema,
} from './expenses.schemas';

const service = new ExpensesService();

// ─── Expenses ─────────────────────────────────────────────────────────────────

export async function createExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { tripId } = req.params;
    const validated = createExpenseSchema.parse(req.body);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expense = await service.createExpense(tripId, userId, validated as any);


    res.status(201).json({ status: 'success', data: expense });
  } catch (err) {
    next(err);
  }
}

export async function getExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { tripId } = req.params;
    const { category, limit, cursor } = expenseQuerySchema.parse(req.query);

    const result = await service.listExpenses(tripId, userId, { category, limit, cursor });

    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function getExpenseById(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { tripId, id } = req.params;
    const expense = await service.getExpense(tripId, id, userId);

    res.status(200).json({ status: 'success', data: expense });
  } catch (err) {
    next(err);
  }
}

export async function updateExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { tripId, id } = req.params;
    const validated = updateExpenseSchema.parse(req.body);

    const expense = await service.updateExpense(tripId, id, userId, validated);

    res.status(200).json({ status: 'success', data: expense });
  } catch (err) {
    next(err);
  }
}

export async function deleteExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { tripId, id } = req.params;

    await service.deleteExpense(tripId, id, userId);

    res.status(200).json({ status: 'success', message: 'Expense deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

// ─── Balances & Summary ───────────────────────────────────────────────────────

export async function getBalances(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { tripId } = req.params;
    const result = await service.calculateBalances(tripId, userId);

    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function getFinancialSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { tripId } = req.params;
    const summary = await service.getFinancialSummary(tripId, userId);

    res.status(200).json({ status: 'success', data: summary });
  } catch (err) {
    next(err);
  }
}

// ─── Settlements ──────────────────────────────────────────────────────────────

export async function getSettlements(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { tripId } = req.params;
    const settlements = await service.listSettlements(tripId, userId);

    res.status(200).json({ status: 'success', data: settlements });
  } catch (err) {
    next(err);
  }
}

export async function recordSettlement(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { tripId } = req.params;
    const validated = recordSettlementSchema.parse(req.body);

    const settlement = await service.recordSettlement(tripId, userId, validated);

    res.status(201).json({ status: 'success', data: settlement });
  } catch (err) {
    next(err);
  }
}

export async function markSettled(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { tripId, id } = req.params;
    const validated = markSettledSchema.parse(req.body);

    const settlement = await service.markSettled(tripId, id, userId, validated);

    res.status(200).json({ status: 'success', data: settlement });
  } catch (err) {
    next(err);
  }
}
