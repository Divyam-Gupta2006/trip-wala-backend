import { Router } from 'express';
import { authMiddleware, validateBody, validateQuery } from '../../core/middlewares';
import {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getBalances,
  getFinancialSummary,
  getSettlements,
  recordSettlement,
  markSettled,
} from './expenses.controller';
import {
  createExpenseSchema,
  updateExpenseSchema,
  recordSettlementSchema,
  markSettledSchema,
  expenseQuerySchema,
} from './expenses.schemas';

export const expensesRouter = Router({ mergeParams: true }); // mergeParams = access tripId from parent

// All expense routes require authentication
expensesRouter.use(authMiddleware);

// ── Expenses (under /api/v1/trips/:tripId/expenses) ──────────────────────────
expensesRouter.post('/', validateBody(createExpenseSchema), createExpense);
expensesRouter.get('/', validateQuery(expenseQuerySchema), getExpenses);
expensesRouter.get('/summary', getFinancialSummary);   // must precede /:id
expensesRouter.get('/:id', getExpenseById);
expensesRouter.put('/:id', validateBody(updateExpenseSchema), updateExpense);
expensesRouter.delete('/:id', deleteExpense);

// ── Balances & Settlements (under /api/v1/trips/:tripId/) ────────────────────
export const balancesRouter = Router({ mergeParams: true });
balancesRouter.use(authMiddleware);
balancesRouter.get('/', getBalances);

export const settlementsRouter = Router({ mergeParams: true });
settlementsRouter.use(authMiddleware);
settlementsRouter.get('/', getSettlements);
settlementsRouter.post('/', validateBody(recordSettlementSchema), recordSettlement);
settlementsRouter.put('/:id', validateBody(markSettledSchema), markSettled);
