import { z } from 'zod';

export const directConversationSchema = z.object({
  targetUserId: z.string().uuid('targetUserId must be a valid UUID'),
});

export const sendMessageSchema = z.object({
  text: z.string().min(1, 'Message text cannot be empty'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  filePath: z.string().optional(),
  replyToMessageId: z.string().uuid().optional(),
  replyToMessageText: z.string().optional(),
  replyToMessageSender: z.string().optional(),
  mentions: z.array(z.string()).optional(),
});

export const editMessageSchema = z.object({
  text: z.string().min(1, 'Message text cannot be empty'),
});

export const addReactionSchema = z.object({
  emoji: z.string().min(1, 'Emoji cannot be empty'),
});

export const messageHistoryQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().min(1).max(100)),
  cursor: z.string().optional(),
});
