import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FriendsService } from '../friends/friends.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Conversation.name) private convModel: Model<ConversationDocument>,
    private usersService: UsersService,
    private friendsService: FriendsService,
    private redis: RedisService,
    private notifications: NotificationsService,
  ) {}

  async getConversationById(conversationId: string, userId: string) {
    const conv = await this.convModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Conversation introuvable');
    if (!conv.participants.some((p) => p.toString() === userId)) {
      throw new ForbiddenException('Non autorisé');
    }
    return this.enrichConversation(conv, userId);
  }

  async getConversations(userId: string) {
    const convs = await this.convModel
      .find({ participants: new Types.ObjectId(userId), isGroup: false })
      .sort({ updatedAt: -1 });
    return Promise.all(convs.map((c) => this.enrichConversation(c, userId)));
  }

  async getOrCreatePrivate(userId: string, otherUserId: string) {
    const areFriends = await this.friendsService.areFriends(userId, otherUserId);
    if (!areFriends) throw new ForbiddenException('Vous devez être amis pour envoyer un message');

    let conv = await this.convModel.findOne({
      participants: { $all: [new Types.ObjectId(userId), new Types.ObjectId(otherUserId)] },
      isGroup: false,
    });
    if (!conv) {
      conv = await this.convModel.create({
        participants: [new Types.ObjectId(userId), new Types.ObjectId(otherUserId)],
        messages: [],
      });
    }
    return this.enrichConversation(conv, userId);
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    data: { type: string; content?: string; mediaUrl?: string },
  ) {
    const conv = await this.convModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Conversation introuvable');
    if (!conv.participants.some((p) => p.toString() === senderId)) {
      throw new ForbiddenException('Non autorisé');
    }
    const message = {
      senderId: new Types.ObjectId(senderId),
      type: data.type,
      content: data.content || '',
      mediaUrl: data.mediaUrl || '',
      createdAt: new Date(),
      read: false,
    };
    conv.messages.push(message as Conversation['messages'][0]);
    await conv.save();
    await this.redis.set(
      `unread:${conversationId}:${senderId}`,
      '0',
    );
    for (const p of conv.participants) {
      if (p.toString() !== senderId) {
        const key = `unread:${conversationId}:${p.toString()}`;
        const current = parseInt((await this.redis.get(key)) || '0', 10);
        await this.redis.set(key, String(current + 1), 86400);
      }
    }
    const sender = await this.usersService.findById(senderId);
    for (const p of conv.participants) {
      if (p.toString() !== senderId) {
        await this.notifications.create({
          userId: p.toString(),
          actorId: senderId,
          type: 'message',
          message: `${sender.displayName} vous a envoyé un message`,
          conversationId,
        });
      }
    }
    const enriched = await this.enrichConversation(conv, senderId);
    return enriched.messages[enriched.messages.length - 1];
  }

  async markRead(conversationId: string, userId: string) {
    const conv = await this.convModel.findById(conversationId);
    if (!conv) return;
    conv.messages.forEach((m) => {
      if (m.senderId.toString() !== userId) m.read = true;
    });
    await conv.save();
    await this.redis.del(`unread:${conversationId}:${userId}`);
  }

  async getTotalUnreadCount(userId: string): Promise<number> {
    const convs = await this.convModel.find({
      participants: new Types.ObjectId(userId),
      isGroup: false,
    });
    let total = 0;
    for (const conv of convs) {
      const unread = parseInt(
        (await this.redis.get(`unread:${conv._id}:${userId}`)) || '0',
        10,
      );
      total += unread;
    }
    return total;
  }

  private async enrichConversation(conv: ConversationDocument, currentUserId: string) {
    const participants = await Promise.all(
      conv.participants.map(async (p) => {
        try {
          const u = await this.usersService.findById(p.toString());
          return this.usersService.toPublic(u);
        } catch {
          return null;
        }
      }),
    );
    const other = participants.find((p) => p && p.id !== currentUserId);
    const lastMessage = conv.messages[conv.messages.length - 1];
    const unread = parseInt(
      (await this.redis.get(`unread:${conv._id}:${currentUserId}`)) || '0',
      10,
    );
    return {
      id: conv._id.toString(),
      participants: participants.filter(Boolean),
      otherParticipant: other,
      messages: await Promise.all(
        conv.messages.map(async (m) => {
          try {
            const sender = await this.usersService.findById(m.senderId.toString());
            return {
              senderId: m.senderId.toString(),
              type: m.type,
              content: m.content,
              mediaUrl: m.mediaUrl,
              createdAt: m.createdAt,
              read: m.read,
              sender: this.usersService.toPublic(sender),
            };
          } catch {
            return null;
          }
        }),
      ).then((msgs) => msgs.filter(Boolean)),
      lastMessage: lastMessage
        ? { content: lastMessage.content, type: lastMessage.type, createdAt: lastMessage.createdAt }
        : null,
      unreadCount: unread,
      updatedAt: (conv as ConversationDocument & { updatedAt?: Date }).updatedAt,
    };
  }
}
