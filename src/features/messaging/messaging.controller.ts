import { Request, Response, NextFunction } from 'express';
import { MessagingService } from './messaging.service';

const service = new MessagingService();

// 1. List conversations
export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const conversations = await service.getConversations(userId);

    return res.status(200).json({
      success: true,
      message: 'Conversations retrieved successfully',
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
}

// 2. Get unread counts
export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const countData = await service.getUnreadCountAcrossAll(userId);

    return res.status(200).json({
      success: true,
      message: 'Unread message counts retrieved successfully',
      data: countData,
    });
  } catch (error) {
    next(error);
  }
}

// 3. Get conversation details
export async function getConversationDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const details = await service.getConversationDetails(id, userId);

    return res.status(200).json({
      success: true,
      message: 'Conversation details retrieved successfully',
      data: details,
    });
  } catch (error) {
    next(error);
  }
}

// 4. Load message history
export async function getMessageHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { limit, cursor } = req.query as any;

    const messages = await service.getMessageHistory(id, userId, limit, cursor);

    return res.status(200).json({
      success: true,
      message: 'Message history retrieved successfully',
      data: messages,
    });
  } catch (error) {
    next(error);
  }
}

// 5. Get or Create direct conversation
export async function getOrCreateDirectConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { targetUserId } = req.body;

    const conversation = await service.getOrCreateDirectConversation(userId, targetUserId);

    return res.status(200).json({
      success: true,
      message: 'Direct conversation resolved successfully',
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
}

// 6. Send message
export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { id } = req.params; // conversationId
    const message = await service.sendMessage(id, userId, req.body);

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error) {
    next(error);
  }
}

// 7. Edit message
export async function editMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { messageId } = req.params;
    const { text } = req.body;

    const message = await service.editMessage(messageId, userId, text);

    return res.status(200).json({
      success: true,
      message: 'Message edited successfully',
      data: message,
    });
  } catch (error) {
    next(error);
  }
}

// 8. Delete message
export async function deleteMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { messageId } = req.params;

    const message = await service.deleteMessage(messageId, userId);

    return res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
      data: message,
    });
  } catch (error) {
    next(error);
  }
}

// 9. Toggle reaction
export async function toggleReaction(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { messageId } = req.params;
    const { emoji } = req.body;

    const message = await service.toggleReaction(messageId, userId, emoji);

    return res.status(200).json({
      success: true,
      message: 'Reaction toggled successfully',
      data: message,
    });
  } catch (error) {
    next(error);
  }
}

// 10. Mark conversation as read
export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const result = await service.markAsRead(id, userId);

    return res.status(200).json({
      success: true,
      message: 'Conversation marked as read successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
