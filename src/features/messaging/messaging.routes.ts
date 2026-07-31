import { Router } from 'express';
import { authMiddleware, validateBody, validateQuery } from '../../core/middlewares';
import {
  listConversations,
  getUnreadCount,
  getConversationDetails,
  getMessageHistory,
  getOrCreateDirectConversation,
  sendMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  markAsRead,
} from './messaging.controller';
import {
  directConversationSchema,
  sendMessageSchema,
  editMessageSchema,
  addReactionSchema,
  messageHistoryQuerySchema,
} from './messaging.schemas';

export const messagingRouter = Router();

// Apply authMiddleware globally to all messaging routes
messagingRouter.use(authMiddleware);

// Conversations management
messagingRouter.get('/', listConversations);
messagingRouter.get('/unread-count', getUnreadCount);
messagingRouter.post('/direct', validateBody(directConversationSchema), getOrCreateDirectConversation);
messagingRouter.get('/:id', getConversationDetails);
messagingRouter.post('/:id/read', markAsRead);

// Message history & sending
messagingRouter.get('/:id/messages', validateQuery(messageHistoryQuerySchema), getMessageHistory);
messagingRouter.post('/:id/messages', validateBody(sendMessageSchema), sendMessage);

// Message operations
messagingRouter.put('/messages/:messageId', validateBody(editMessageSchema), editMessage);
messagingRouter.delete('/messages/:messageId', deleteMessage);
messagingRouter.post('/messages/:messageId/react', validateBody(addReactionSchema), toggleReaction);
