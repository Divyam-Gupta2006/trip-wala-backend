import { prisma } from '../../core/db';
import { Conversation, Message, ConversationParticipant } from '@prisma/client';

export class MessagingRepository {
  // 1. Find direct conversation between two users
  async findDirectConversation(userAId: string, userBId: string) {
    return prisma.conversation.findFirst({
      where: {
        type: 'direct',
        AND: [
          {
            participants: {
              some: { userId: userAId },
            },
          },
          {
            participants: {
              some: { userId: userBId },
            },
          },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });
  }

  // 2. Create a new direct conversation
  async createDirectConversation(userAId: string, userBId: string) {
    return prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.create({
        data: {
          type: 'direct',
        },
      });

      await tx.conversationParticipant.createMany({
        data: [
          { conversationId: conv.id, userId: userAId },
          { conversationId: conv.id, userId: userBId },
        ],
      });

      return tx.conversation.findUnique({
        where: { id: conv.id },
        include: {
          participants: {
            include: {
              user: {
                include: {
                  profile: true,
                },
              },
            },
          },
        },
      });
    });
  }

  // 3. Find conversation by ID
  async getConversationById(id: string) {
    return prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
        trip: true,
      },
    });
  }

  // 4. List all conversations for a user
  async listConversations(userId: string) {
    return prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
        trip: {
          include: {
            members: true,
          },
        },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // 5. Load message history with cursor pagination
  async getMessagesByConversation(conversationId: string, limit: number, cursor?: string) {
    const query: any = {
      where: { conversationId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        sender: {
          include: {
            profile: true,
          },
        },
      },
    };

    if (cursor) {
      query.cursor = { id: cursor };
      query.skip = 1; // Skip the cursor element itself
    }

    return prisma.message.findMany(query);
  }

  // 6. Save a message
  async createMessage(data: {
    conversationId: string;
    tripId?: string;
    senderId: string;
    senderName: string;
    text: string;
    type?: string;
    imageUrl?: string;
    filePath?: string;
    replyToMessageId?: string;
    replyToMessageText?: string;
    replyToMessageSender?: string;
    mentions?: string[];
  }) {
    return prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId: data.conversationId,
          tripId: data.tripId,
          senderId: data.senderId,
          senderName: data.senderName,
          text: data.text,
          type: data.type || 'text',
          imageUrl: data.imageUrl,
          filePath: data.filePath,
          replyToMessageId: data.replyToMessageId,
          replyToMessageText: data.replyToMessageText,
          replyToMessageSender: data.replyToMessageSender,
          mentions: data.mentions ? JSON.stringify(data.mentions) : '[]',
          reactions: {},
        },
        include: {
          sender: {
            include: {
              profile: true,
            },
          },
        },
      });

      // Update conversation updatedAt timestamp to float it to top of list
      await tx.conversation.update({
        where: { id: data.conversationId },
        data: { updatedAt: new Date() },
      });

      return msg;
    });
  }

  // 7. Get Message by ID
  async getMessageById(id: string) {
    return prisma.message.findUnique({
      where: { id },
      include: {
        conversation: {
          include: {
            participants: true,
          },
        },
      },
    });
  }

  // 8. Update a message (edit)
  async updateMessage(id: string, text: string) {
    return prisma.message.update({
      where: { id },
      data: {
        text,
        isEdited: true,
      },
      include: {
        sender: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  // 9. Soft-delete a message
  async deleteMessage(id: string) {
    return prisma.message.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        text: 'This message was deleted.',
      },
      include: {
        sender: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  // 10. Update last read status for a participant
  async updateLastRead(conversationId: string, userId: string) {
    return prisma.conversationParticipant.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: {
        lastReadAt: new Date(),
      },
    });
  }

  // 11. Manage Reactions (Toggle behavior: if user already reacted with this emoji, remove it; else add it)
  async toggleReaction(messageId: string, userId: string, emoji: string) {
    return prisma.$transaction(async (tx) => {
      const msg = await tx.message.findUnique({
        where: { id: messageId },
      });

      if (!msg) return null;

      const rawReactions = typeof msg.reactions === 'string'
        ? JSON.parse(msg.reactions)
        : JSON.parse(JSON.stringify(msg.reactions || {}));
      const list = rawReactions[emoji] || [];

      let updatedList: string[];
      if (list.includes(userId)) {
        // Remove reaction
        updatedList = list.filter((id: string) => id !== userId);
      } else {
        // Add reaction
        updatedList = [...list, userId];
      }

      if (updatedList.length === 0) {
        delete rawReactions[emoji];
      } else {
        rawReactions[emoji] = updatedList;
      }

      return tx.message.update({
        where: { id: messageId },
        data: {
          reactions: rawReactions,
        },
        include: {
          sender: {
            include: {
              profile: true,
            },
          },
        },
      });
    });
  }

  // 12. Calculate unread counts for a user in a specific conversation
  async getUnreadCount(conversationId: string, userId: string) {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    if (!participant) return 0;

    return prisma.message.count({
      where: {
        conversationId,
        timestamp: {
          gt: participant.lastReadAt,
        },
        senderId: {
          not: userId, // Don't count my own messages as unread
        },
      },
    });
  }

  // 13. Calculate unread counts across all conversations
  async getUnreadCountAcrossAll(userId: string) {
    const participations = await prisma.conversationParticipant.findMany({
      where: { userId },
    });

    let total = 0;
    for (const p of participations) {
      const count = await prisma.message.count({
        where: {
          conversationId: p.conversationId,
          timestamp: {
            gt: p.lastReadAt,
          },
          senderId: {
            not: userId,
          },
        },
      });
      total += count;
    }
    return total;
  }
}
