"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchProfilesSchema = exports.updateProfileSchema = void 0;
const zod_1 = require("zod");
exports.updateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
    username: zod_1.z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username cannot exceed 30 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
        .optional(),
    bio: zod_1.z.string().max(500, 'Bio cannot exceed 500 characters').optional(),
    avatarUrl: zod_1.z.string().url('Invalid avatar image URL').or(zod_1.z.string().length(0)).nullable().optional(),
    coverImageUrl: zod_1.z.string().url('Invalid cover image URL').or(zod_1.z.string().length(0)).nullable().optional(),
    location: zod_1.z.string().max(100).optional(),
    interests: zod_1.z.array(zod_1.z.string()).optional(),
    travelStyles: zod_1.z.array(zod_1.z.string()).optional(),
    travelPreferences: zod_1.z.array(zod_1.z.string()).optional(),
    budgetPreference: zod_1.z.enum(['budget', 'balanced', 'luxury']).optional(),
    socialAccounts: zod_1.z.array(zod_1.z.string()).optional(),
    languages: zod_1.z.array(zod_1.z.string()).optional(),
    age: zod_1.z.number().int().min(18, 'Must be at least 18 years old').max(120).optional(),
});
exports.searchProfilesSchema = zod_1.z.object({
    query: zod_1.z.string().optional(),
    minAge: zod_1.z.string().transform(val => parseInt(val, 10)).pipe(zod_1.z.number().int().min(18)).optional(),
    maxAge: zod_1.z.string().transform(val => parseInt(val, 10)).pipe(zod_1.z.number().int().max(120)).optional(),
    budgetPreference: zod_1.z.enum(['budget', 'balanced', 'luxury']).optional(),
    interests: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).transform(val => (Array.isArray(val) ? val : [val])).optional(),
    travelStyles: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).transform(val => (Array.isArray(val) ? val : [val])).optional(),
    languages: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).transform(val => (Array.isArray(val) ? val : [val])).optional(),
    minTrustScore: zod_1.z.string().transform(val => parseInt(val, 10)).pipe(zod_1.z.number().int().min(0)).optional(),
    verifiedOnly: zod_1.z.string().transform(val => val === 'true').optional(),
    page: zod_1.z.string().default('1').transform(val => parseInt(val, 10)).pipe(zod_1.z.number().int().min(1)),
    limit: zod_1.z.string().default('10').transform(val => parseInt(val, 10)).pipe(zod_1.z.number().int().min(1).max(100)),
});
