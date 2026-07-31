"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagingRouter = void 0;
const express_1 = require("express");
const middlewares_1 = require("../../core/middlewares");
const messaging_controller_1 = require("./messaging.controller");
const messaging_schemas_1 = require("./messaging.schemas");
exports.messagingRouter = (0, express_1.Router)();
// Apply authMiddleware globally to all messaging routes
exports.messagingRouter.use(middlewares_1.authMiddleware);
// Conversations management
exports.messagingRouter.get('/', messaging_controller_1.listConversations);
exports.messagingRouter.get('/unread-count', messaging_controller_1.getUnreadCount);
exports.messagingRouter.post('/direct', (0, middlewares_1.validateBody)(messaging_schemas_1.directConversationSchema), messaging_controller_1.getOrCreateDirectConversation);
exports.messagingRouter.get('/:id', messaging_controller_1.getConversationDetails);
exports.messagingRouter.post('/:id/read', messaging_controller_1.markAsRead);
// Message history & sending
exports.messagingRouter.get('/:id/messages', (0, middlewares_1.validateQuery)(messaging_schemas_1.messageHistoryQuerySchema), messaging_controller_1.getMessageHistory);
exports.messagingRouter.post('/:id/messages', (0, middlewares_1.validateBody)(messaging_schemas_1.sendMessageSchema), messaging_controller_1.sendMessage);
// Message operations
exports.messagingRouter.put('/messages/:messageId', (0, middlewares_1.validateBody)(messaging_schemas_1.editMessageSchema), messaging_controller_1.editMessage);
exports.messagingRouter.delete('/messages/:messageId', messaging_controller_1.deleteMessage);
exports.messagingRouter.post('/messages/:messageId/react', (0, middlewares_1.validateBody)(messaging_schemas_1.addReactionSchema), messaging_controller_1.toggleReaction);
