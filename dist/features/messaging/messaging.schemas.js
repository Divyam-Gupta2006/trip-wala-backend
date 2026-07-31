"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageHistoryQuerySchema = exports.addReactionSchema = exports.editMessageSchema = exports.sendMessageSchema = exports.directConversationSchema = void 0;
const zod_1 = require("zod");
exports.directConversationSchema = zod_1.z.object({
    targetUserId: zod_1.z.string().uuid('targetUserId must be a valid UUID'),
});
exports.sendMessageSchema = zod_1.z.object({
    text: zod_1.z.string().min(1, 'Message text cannot be empty'),
    imageUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    filePath: zod_1.z.string().optional(),
    replyToMessageId: zod_1.z.string().uuid().optional(),
    replyToMessageText: zod_1.z.string().optional(),
    replyToMessageSender: zod_1.z.string().optional(),
    mentions: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.editMessageSchema = zod_1.z.object({
    text: zod_1.z.string().min(1, 'Message text cannot be empty'),
});
exports.addReactionSchema = zod_1.z.object({
    emoji: zod_1.z.string().min(1, 'Emoji cannot be empty'),
});
exports.messageHistoryQuerySchema = zod_1.z.object({
    limit: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 20))
        .pipe(zod_1.z.number().min(1).max(100)),
    cursor: zod_1.z.string().optional(),
});
