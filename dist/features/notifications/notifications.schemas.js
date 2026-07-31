"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePreferencesSchema = exports.paginationQuerySchema = void 0;
const zod_1 = require("zod");
exports.paginationQuerySchema = zod_1.z.object({
    limit: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 20))
        .pipe(zod_1.z.number().min(1).max(100)),
    cursor: zod_1.z.string().optional(),
});
exports.updatePreferencesSchema = zod_1.z.object({
    chat: zod_1.z.boolean().optional(),
    trips: zod_1.z.boolean().optional(),
    invitations: zod_1.z.boolean().optional(),
    applications: zod_1.z.boolean().optional(),
    marketing: zod_1.z.boolean().optional(),
    system: zod_1.z.boolean().optional(),
});
