import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RedisKeys, RedisTTL } from '../redis/redis-keys';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { Notification, NotificationDocument } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  private emitFn: ((userId: string, notification: unknown) => void) | null = null;

  constructor(
    @InjectModel(Notification.name) private notifModel: Model<NotificationDocument>,
    private usersService: UsersService,
    private redis: RedisService,
  ) {}

  setEmitter(fn: (userId: string, notification: unknown) => void) {
    this.emitFn = fn;
  }

  async create(data: {
    userId: string;
    actorId: string;
    type: string;
    message: string;
    postId?: string;
    conversationId?: string;
  }) {
    if (data.userId === data.actorId) return null;
    const notif = await this.notifModel.create({
      userId: new Types.ObjectId(data.userId),
      actorId: new Types.ObjectId(data.actorId),
      type: data.type,
      message: data.message,
      postId: data.postId ? new Types.ObjectId(data.postId) : null,
      conversationId: data.conversationId ? new Types.ObjectId(data.conversationId) : null,
    });
    await this.redis.del(RedisKeys.notifList(data.userId));
    const enriched = await this.enrich(notif);
    this.emitFn?.(data.userId, enriched);
    return enriched;
  }

  async getForUser(userId: string, limit = 30) {
    const cacheKey = RedisKeys.notifList(userId);
    const cached = await this.redis.getJson<unknown[]>(cacheKey);
    if (cached) return cached;

    const notifs = await this.notifModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit);
    const enriched = await Promise.all(notifs.map((n) => this.enrich(n)));
    await this.redis.setJson(cacheKey, enriched, RedisTTL.notifList);
    return enriched;
  }

  async getUnreadCount(userId: string) {
    return this.notifModel.countDocuments({
      userId: new Types.ObjectId(userId),
      read: false,
    });
  }

  async markAllRead(userId: string) {
    await this.notifModel.updateMany(
      { userId: new Types.ObjectId(userId), read: false },
      { read: true },
    );
    await this.redis.del(RedisKeys.notifList(userId));
    return { message: 'OK' };
  }

  async markRead(id: string, userId: string) {
    await this.notifModel.updateOne(
      { _id: id, userId: new Types.ObjectId(userId) },
      { read: true },
    );
    await this.redis.del(RedisKeys.notifList(userId));
    return { message: 'OK' };
  }

  private async enrich(notif: NotificationDocument) {
    let actor: unknown = null;
    try {
      const u = await this.usersService.findById(notif.actorId.toString());
      actor = this.usersService.toPublic(u);
    } catch {
      actor = null;
    }
    return {
      id: notif._id.toString(),
      type: notif.type,
      message: notif.message,
      read: notif.read,
      postId: notif.postId?.toString() || null,
      conversationId: notif.conversationId?.toString() || null,
      actor,
      createdAt: (notif as NotificationDocument & { createdAt?: Date }).createdAt,
    };
  }
}
