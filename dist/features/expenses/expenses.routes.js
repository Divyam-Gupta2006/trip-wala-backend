"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementsRouter = exports.balancesRouter = exports.expensesRouter = void 0;
const express_1 = require("express");
const middlewares_1 = require("../../core/middlewares");
const expenses_controller_1 = require("./expenses.controller");
const expenses_schemas_1 = require("./expenses.schemas");
exports.expensesRouter = (0, express_1.Router)({ mergeParams: true }); // mergeParams = access tripId from parent
// All expense routes require authentication
exports.expensesRouter.use(middlewares_1.authMiddleware);
// ── Expenses (under /api/v1/trips/:tripId/expenses) ──────────────────────────
exports.expensesRouter.post('/', (0, middlewares_1.validateBody)(expenses_schemas_1.createExpenseSchema), expenses_controller_1.createExpense);
exports.expensesRouter.get('/', (0, middlewares_1.validateQuery)(expenses_schemas_1.expenseQuerySchema), expenses_controller_1.getExpenses);
exports.expensesRouter.get('/summary', expenses_controller_1.getFinancialSummary); // must precede /:id
exports.expensesRouter.get('/:id', expenses_controller_1.getExpenseById);
exports.expensesRouter.put('/:id', (0, middlewares_1.validateBody)(expenses_schemas_1.updateExpenseSchema), expenses_controller_1.updateExpense);
exports.expensesRouter.delete('/:id', expenses_controller_1.deleteExpense);
// ── Balances & Settlements (under /api/v1/trips/:tripId/) ────────────────────
exports.balancesRouter = (0, express_1.Router)({ mergeParams: true });
exports.balancesRouter.use(middlewares_1.authMiddleware);
exports.balancesRouter.get('/', expenses_controller_1.getBalances);
exports.settlementsRouter = (0, express_1.Router)({ mergeParams: true });
exports.settlementsRouter.use(middlewares_1.authMiddleware);
exports.settlementsRouter.get('/', expenses_controller_1.getSettlements);
exports.settlementsRouter.post('/', (0, middlewares_1.validateBody)(expenses_schemas_1.recordSettlementSchema), expenses_controller_1.recordSettlement);
exports.settlementsRouter.put('/:id', (0, middlewares_1.validateBody)(expenses_schemas_1.markSettledSchema), expenses_controller_1.markSettled);
