"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpense = createExpense;
exports.getExpenses = getExpenses;
exports.getExpenseById = getExpenseById;
exports.updateExpense = updateExpense;
exports.deleteExpense = deleteExpense;
exports.getBalances = getBalances;
exports.getFinancialSummary = getFinancialSummary;
exports.getSettlements = getSettlements;
exports.recordSettlement = recordSettlement;
exports.markSettled = markSettled;
const expenses_service_1 = require("./expenses.service");
const expenses_schemas_1 = require("./expenses.schemas");
const service = new expenses_service_1.ExpensesService();
// ─── Expenses ─────────────────────────────────────────────────────────────────
async function createExpense(req, res, next) {
    try {
        const userId = req.user.id;
        const { tripId } = req.params;
        const validated = expenses_schemas_1.createExpenseSchema.parse(req.body);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expense = await service.createExpense(tripId, userId, validated);
        res.status(201).json({ status: 'success', data: expense });
    }
    catch (err) {
        next(err);
    }
}
async function getExpenses(req, res, next) {
    try {
        const userId = req.user.id;
        const { tripId } = req.params;
        const { category, limit, cursor } = expenses_schemas_1.expenseQuerySchema.parse(req.query);
        const result = await service.listExpenses(tripId, userId, { category, limit, cursor });
        res.status(200).json({ status: 'success', data: result });
    }
    catch (err) {
        next(err);
    }
}
async function getExpenseById(req, res, next) {
    try {
        const userId = req.user.id;
        const { tripId, id } = req.params;
        const expense = await service.getExpense(tripId, id, userId);
        res.status(200).json({ status: 'success', data: expense });
    }
    catch (err) {
        next(err);
    }
}
async function updateExpense(req, res, next) {
    try {
        const userId = req.user.id;
        const { tripId, id } = req.params;
        const validated = expenses_schemas_1.updateExpenseSchema.parse(req.body);
        const expense = await service.updateExpense(tripId, id, userId, validated);
        res.status(200).json({ status: 'success', data: expense });
    }
    catch (err) {
        next(err);
    }
}
async function deleteExpense(req, res, next) {
    try {
        const userId = req.user.id;
        const { tripId, id } = req.params;
        await service.deleteExpense(tripId, id, userId);
        res.status(200).json({ status: 'success', message: 'Expense deleted successfully.' });
    }
    catch (err) {
        next(err);
    }
}
// ─── Balances & Summary ───────────────────────────────────────────────────────
async function getBalances(req, res, next) {
    try {
        const userId = req.user.id;
        const { tripId } = req.params;
        const result = await service.calculateBalances(tripId, userId);
        res.status(200).json({ status: 'success', data: result });
    }
    catch (err) {
        next(err);
    }
}
async function getFinancialSummary(req, res, next) {
    try {
        const userId = req.user.id;
        const { tripId } = req.params;
        const summary = await service.getFinancialSummary(tripId, userId);
        res.status(200).json({ status: 'success', data: summary });
    }
    catch (err) {
        next(err);
    }
}
// ─── Settlements ──────────────────────────────────────────────────────────────
async function getSettlements(req, res, next) {
    try {
        const userId = req.user.id;
        const { tripId } = req.params;
        const settlements = await service.listSettlements(tripId, userId);
        res.status(200).json({ status: 'success', data: settlements });
    }
    catch (err) {
        next(err);
    }
}
async function recordSettlement(req, res, next) {
    try {
        const userId = req.user.id;
        const { tripId } = req.params;
        const validated = expenses_schemas_1.recordSettlementSchema.parse(req.body);
        const settlement = await service.recordSettlement(tripId, userId, validated);
        res.status(201).json({ status: 'success', data: settlement });
    }
    catch (err) {
        next(err);
    }
}
async function markSettled(req, res, next) {
    try {
        const userId = req.user.id;
        const { tripId, id } = req.params;
        const validated = expenses_schemas_1.markSettledSchema.parse(req.body);
        const settlement = await service.markSettled(tripId, id, userId, validated);
        res.status(200).json({ status: 'success', data: settlement });
    }
    catch (err) {
        next(err);
    }
}
