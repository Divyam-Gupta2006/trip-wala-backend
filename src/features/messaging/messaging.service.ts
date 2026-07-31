import { MessagingRepository } from './messaging.repository';
import { ApiError } from '../../core/errors';
import { prisma } from '../../core/db';
import { Role } from '@prisma/client';

export class MessagingService {
  private repo = new MessagingRepository();

  // --- Auth Helper ---
  async verifyAccess(conversationId: string, userId: string) {
    const conversation = await this.repo.getConversationById(conversationId);
    if (!conversation) {
      throw new ApiError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
    }

    if (conversation.type === 'trip') {
      // For trip chats, verify the user is an active member of the trip
      const tripId = conversation.tripId!;
      const membership = await prisma.tripMember.findUnique({
        where: { tripId_userId: { tripId, userId } },
      });
      if (!membership) {
        throw new ApiError(403, 'FORBIDDEN_CHAT_ACCESS', 'You must be a member of the trip to access this chat.');
      }
    } else {
      // For direct chats, verify the user is a participant
      const isParticipant = conversation.participants.some((p) => p.userId === userId);
      if (!isParticipant) {
        throw new ApiError(403, 'FORBIDDEN_CHAT_ACCESS', 'You are not a participant in this conversation.');
      }
    }

    return conversation;
  }

  // --- Direct Conversation Creation ---
  async getOrCreateDirectConversation(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new ApiError(400, 'INVALID_TARGET_USER', 'You cannot start a direct message with yourself.');
    }

    // Verify target user exists and is not soft-deleted
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { profile: true },
    });

    if (!targetUser || targetUser.isDeleted) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'The target user does not exist or has deleted their account.');
    }

    // Check if conversation already exists
    const existing = await this.repo.findDirectConversation(userId, targetUserId);
    if (existing) {
      return this.formatConversation(existing, userId);
    }

    // Create a new direct conversation
    const newConv = await this.repo.createDirectConversation(userId, targetUserId);
    if (!newConv) {
      throw new ApiError(500, 'DATABASE_ERROR', 'Failed to create direct conversation.');
    }

    return this.formatConversation(newConv, userId);
  }

  // --- List Conversations ---
  async getConversations(userId: string) {
    const list = await this.repo.listConversations(userId);
    const formatted = await Promise.all(
      list.map((c) => this.formatConversation(c, userId))
    );
    return formatted;
  }

  // --- Get Conversation Details ---
  async getConversationDetails(conversationId: string, userId: string) {
    await this.verifyAccess(conversationId, userId);
    const c = await this.repo.getConversationById(conversationId);
    if (!c) {
      throw new ApiError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
    }
    return this.formatConversation(c, userId);
  }

  // --- Load Message History ---
  async getMessageHistory(conversationId: string, userId: string, limit: number, cursor?: string) {
    await this.verifyAccess(conversationId, userId);
    const messages = await this.repo.getMessagesByConversation(conversationId, limit, cursor);
    return messages.map(this.formatMessage);
  }

  // --- Send Message ---
  async sendMessage(
    conversationId: string,
    senderId: string,
    data: {
      text: string;
      imageUrl?: string;
      filePath?: string;
      replyToMessageId?: string;
      replyToMessageText?: string;
      replyToMessageSender?: string;
      mentions?: string[];
    }
  ) {
    const conversation = await this.verifyAccess(conversationId, senderId);

    // Get sender details
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      include: { profile: true },
    });

    if (!sender) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Sender not found.');
    }

    const message = await this.repo.createMessage({
      conversationId,
      tripId: conversation.tripId || undefined,
      senderId,
      senderName: sender.name,
      text: data.text,
      type: data.imageUrl || data.filePath ? 'attachment' : 'text',
      imageUrl: data.imageUrl,
      filePath: data.filePath,
      replyToMessageId: data.replyToMessageId,
      replyToMessageText: data.replyToMessageText,
      replyToMessageSender: data.replyToMessageSender,
      mentions: data.mentions,
    });

    return this.formatMessage(message);
  }

  // --- Edit Message ---
  async editMessage(messageId: string, userId: string, text: string) {
    const message = await this.repo.getMessageById(messageId);
    if (!message) {
      throw new ApiError(404, 'MESSAGE_NOT_FOUND', 'Message not found.');
    }

    if (message.senderId !== userId) {
      throw new ApiError(403, 'FORBIDDEN_MESSAGE_EDIT', 'You can only edit your own messages.');
    }

    if (message.isDeleted) {
      throw new ApiError(400, 'INVALID_MESSAGE_STATE', 'Cannot edit a deleted message.');
    }

    const updated = await this.repo.updateMessage(messageId, text);
    return this.formatMessage(updated);
  }

  // --- Delete Message ---
  async deleteMessage(messageId: string, userId: string) {
    const message = await this.repo.getMessageById(messageId);
    if (!message) {
      throw new ApiError(404, 'MESSAGE_NOT_FOUND', 'Message not found.');
    }

    if (message.senderId !== userId) {
      throw new ApiError(403, 'FORBIDDEN_MESSAGE_DELETE', 'You can only delete your own messages.');
    }

    const deleted = await this.repo.deleteMessage(messageId);
    return this.formatMessage(deleted);
  }

  // --- Toggle Reaction ---
  async toggleReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.repo.getMessageById(messageId);
    if (!message) {
      throw new ApiError(404, 'MESSAGE_NOT_FOUND', 'Message not found.');
    }

    // Verify user has access to conversation
    await this.verifyAccess(message.conversationId, userId);

    if (message.isDeleted) {
      throw new ApiError(400, 'INVALID_MESSAGE_STATE', 'Cannot react to a deleted message.');
    }

    const updated = await this.repo.toggleReaction(messageId, userId, emoji);
    if (!updated) {
      throw new ApiError(500, 'DATABASE_ERROR', 'Failed to update emoji reaction.');
    }

    return this.formatMessage(updated);
  }

  // --- Mark Read ---
  async markAsRead(conversationId: string, userId: string) {
    await this.verifyAccess(conversationId, userId);
    await this.repo.updateLastRead(conversationId, userId);
    return { success: true };
  }

  // --- Unread Counts ---
  async getUnreadCountAcrossAll(userId: string) {
    const count = await this.repo.getUnreadCountAcrossAll(userId);
    return { unreadCount: count };
  }

  // --- Formatters ---
  private async formatConversation(conv: any, currentUserId: string) {
    let name = conv.name || '';
    let imageUrl = conv.imageUrl || '';
    let tripId = conv.tripId || '';
    let isPastTrip = false;

    if (conv.type === 'trip' && conv.trip) {
      name = conv.trip.title;
      imageUrl = conv.trip.imageUrl || '';
      tripId = conv.trip.id;
      isPastTrip = conv.trip.endDate < new Date();
    } else if (conv.type === 'direct') {
      // Direct message: Name and image resolved from target participant
      const otherParticipant = conv.participants.find((p: any) => p.userId !== currentUserId);
      if (otherParticipant) {
        name = otherParticipant.user.name;
        imageUrl = otherParticipant.user.profile?.avatarUrl || '';
      } else {
        name = 'Chat';
      }
    }

    const lastMessage = conv.messages && conv.messages.length > 0 ? conv.messages[0] : null;
    const lastMessageText = lastMessage ? (lastMessage.isDeleted ? 'This message was deleted.' : lastMessage.text) : 'No messages yet';
    const lastMessageTime = lastMessage ? lastMessage.timestamp : conv.updatedAt;

    // Fetch unread count for current user
    const unreadCount = await this.repo.getUnreadCount(conv.id, currentUserId);

    return {
      id: conv.id,
      name,
      imageUrl: imageUrl || null,
      lastMessageText,
      lastMessageTime: lastMessageTime.toISOString(),
      unreadCount,
      isArchived: false,
      tripId: tripId || null,
      isPastTrip,
    };
  }

  private formatMessage(msg: any) {
    let parsedReactions: Record<string, string[]> = {};
    try {
      parsedReactions = typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : (msg.reactions as Record<string, string[]> || {});
    } catch {
      parsedReactions = {};
    }

    let parsedMentions: string[] = [];
    try {
      parsedMentions = typeof msg.mentions === 'string' ? JSON.parse(msg.mentions) : (msg.mentions as string[] || []);
    } catch {
      parsedMentions = [];
    }

    return {
      id: msg.id,
      chatId: msg.conversationId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      senderAvatarUrl: msg.sender?.profile?.avatarUrl || null,
      text: msg.text,
      timestamp: msg.timestamp.toISOString(),
      imageUrl: msg.imageUrl || null,
      filePath: msg.filePath || null,
      replyToMessageId: msg.replyToMessageId || null,
      replyToMessageText: msg.replyToMessageText || null,
      replyToMessageSender: msg.replyToMessageSender || null,
      reactions: parsedReactions,
      pinned: msg.isPinned,
      mentions: parsedMentions,
    };
  }
}
