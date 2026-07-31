"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingRepository = void 0;
const db_1 = require("../../core/db");
class MessagingRepository {
    // 1. Find direct conversation between two users
    async findDirectConversation(userAId, userBId) {
        return db_1.prisma.conversation.findFirst({
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
    async createDirectConversation(userAId, userBId) {
        return db_1.prisma.$transaction(async (tx) => {
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
    async getConversationById(id) {
        return db_1.prisma.conversation.findUnique({
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
    async listConversations(userId) {
        return db_1.prisma.conversation.findMany({
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
    async getMessagesByConversation(conversationId, limit, cursor) {
        const query = {
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
        return db_1.prisma.message.findMany(query);
    }
    // 6. Save a message
    async createMessage(data) {
        return db_1.prisma.$transaction(async (tx) => {
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
    async getMessageById(id) {
        return db_1.prisma.message.findUnique({
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
    async updateMessage(id, text) {
        return db_1.prisma.message.update({
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
    async deleteMessage(id) {
        return db_1.prisma.message.update({
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
    async updateLastRead(conversationId, userId) {
        return db_1.prisma.conversationParticipant.update({
            where: {
                conversationId_userId: { conversationId, userId },
            },
            data: {
                lastReadAt: new Date(),
            },
        });
    }
    // 11. Manage Reactions (Toggle behavior: if user already reacted with this emoji, remove it; else add it)
    async toggleReaction(messageId, userId, emoji) {
        return db_1.prisma.$transaction(async (tx) => {
            const msg = await tx.message.findUnique({
                where: { id: messageId },
            });
            if (!msg)
                return null;
            const rawReactions = typeof msg.reactions === 'string'
                ? JSON.parse(msg.reactions)
                : JSON.parse(JSON.stringify(msg.reactions || {}));
            const list = rawReactions[emoji] || [];
            let updatedList;
            if (list.includes(userId)) {
                // Remove reaction
                updatedList = list.filter((id) => id !== userId);
            }
            else {
                // Add reaction
                updatedList = [...list, userId];
            }
            if (updatedList.length === 0) {
                delete rawReactions[emoji];
            }
            else {
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
    async getUnreadCount(conversationId, userId) {
        const participant = await db_1.prisma.conversationParticipant.findUnique({
            where: { conversationId_userId: { conversationId, userId } },
        });
        if (!participant)
            return 0;
        return db_1.prisma.message.count({
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
    async getUnreadCountAcrossAll(userId) {
        const participations = await db_1.prisma.conversationParticipant.findMany({
            where: { userId },
        });
        let total = 0;
        for (const p of participations) {
            const count = await db_1.prisma.message.count({
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
exports.MessagingRepository = MessagingRepository;
