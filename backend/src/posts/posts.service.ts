import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FriendsService } from '../friends/friends.service';
import { RedisKeys, RedisTTL } from '../redis/redis-keys';
import { RedisService } from '../redis/redis.service';
import { MediaService } from '../media/media.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Post, PostDocument } from './schemas/post.schema';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private friendsService: FriendsService,
    private usersService: UsersService,
    private redis: RedisService,
    private notifications: NotificationsService,
    private mediaService: MediaService,
  ) {}

  async create(
    authorId: string,
    data: { content?: string; media?: { type: string; mediaId?: string; text?: string }[]; groupId?: string },
  ) {
    const content = (data.content || '').trim();
    const media = data.media || [];
    if (!content && media.length === 0) {
      throw new BadRequestException('La publication ne peut pas être vide');
    }
    for (const item of media) {
      if (item.mediaId) {
        await this.mediaService.assertOwnedBy(item.mediaId, authorId);
      }
    }
    const post = await this.postModel.create({
      authorId: new Types.ObjectId(authorId),
      content,
      media,
      groupId: data.groupId ? new Types.ObjectId(data.groupId) : null,
    });
    await this.redis.invalidatePattern(RedisKeys.feedPattern());
    return this.enrichPost(post);
  }

  async getFeed(userId: string, page = 1, limit = 20) {
    const cacheKey = RedisKeys.feed(userId, page);
    const cached = await this.redis.getJson<unknown[]>(cacheKey);
    if (cached) return cached;

    const friendIds = await this.friendsService.getFriendIds(userId);
    const authorIds = [new Types.ObjectId(userId), ...friendIds.map((id) => new Types.ObjectId(id))];

    const posts = await this.postModel
      .find({ authorId: { $in: authorIds }, groupId: null })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const enriched = await Promise.all(posts.map((p) => this.enrichPost(p)));
    await this.redis.setJson(cacheKey, enriched, RedisTTL.feed);
    return enriched;
  }

  async getUserPosts(profileUserId: string, viewerId: string) {
    const isOwn = profileUserId === viewerId;
    const isFriend = isOwn || (await this.friendsService.areFriends(viewerId, profileUserId));
    if (!isFriend) throw new ForbiddenException('Accès refusé au fil de cet utilisateur');

    const posts = await this.postModel
      .find({ authorId: new Types.ObjectId(profileUserId), groupId: null })
      .sort({ createdAt: -1 })
      .limit(50);
    return Promise.all(posts.map((p) => this.enrichPost(p)));
  }

  async getGroupPosts(groupId: string) {
    const posts = await this.postModel
      .find({ groupId: new Types.ObjectId(groupId) })
      .sort({ createdAt: -1 });
    return Promise.all(posts.map((p) => this.enrichPost(p)));
  }

  async addReaction(postId: string, userId: string, type: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Publication introuvable');
    post.reactions = post.reactions.filter((r) => r.userId.toString() !== userId);
    post.reactions.push({ userId: new Types.ObjectId(userId), type } as Post['reactions'][0]);
    await post.save();
    await this.redis.invalidatePattern(RedisKeys.feedPattern());

    const actor = await this.usersService.findById(userId);
    await this.notifications.create({
      userId: post.authorId.toString(),
      actorId: userId,
      type: 'like',
      message: `${actor.displayName} a réagi à votre publication`,
      postId,
    });

    return this.enrichPost(post);
  }

  async getReactionsDetail(postId: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Publication introuvable');
    const items = await Promise.all(
      post.reactions.map(async (r) => {
        try {
          const u = await this.usersService.findById(r.userId.toString());
          return {
            user: this.usersService.toPublic(u),
            type: r.type,
          };
        } catch {
          return null;
        }
      }),
    );
    return items.filter(Boolean);
  }

  async addComment(
    postId: string,
    userId: string,
    data: { content: string; mediaId?: string; mediaType?: string },
  ) {
    const content = (data.content || '').trim();
    if (!content && !data.mediaId) {
      throw new BadRequestException('Le commentaire ne peut pas être vide');
    }
    if (data.mediaId) {
      await this.mediaService.assertOwnedBy(data.mediaId, userId);
    }
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Publication introuvable');
    post.comments.push({
      userId: new Types.ObjectId(userId),
      content,
      mediaId: data.mediaId || null,
      mediaType: data.mediaType || 'text',
    } as Post['comments'][0]);
    await post.save();
    await this.redis.invalidatePattern(RedisKeys.feedPattern());

    const actor = await this.usersService.findById(userId);
    await this.notifications.create({
      userId: post.authorId.toString(),
      actorId: userId,
      type: 'comment',
      message: `${actor.displayName} a commenté votre publication`,
      postId,
    });

    return this.enrichPost(post);
  }

  async addCommentReaction(
    postId: string,
    commentId: string,
    userId: string,
    type: string,
  ) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Publication introuvable');
    const comment = post.comments.find(
      (c) => (c as { _id?: Types.ObjectId })._id?.toString() === commentId,
    );
    if (!comment) throw new NotFoundException('Commentaire introuvable');
    comment.reactions = comment.reactions.filter((r) => r.userId.toString() !== userId);
    comment.reactions.push({ userId: new Types.ObjectId(userId), type } as Post['comments'][0]['reactions'][0]);
    await post.save();
    await this.redis.invalidatePattern(RedisKeys.feedPattern());
    return this.enrichPost(post);
  }

  async addCommentReply(
    postId: string,
    commentId: string,
    userId: string,
    data: { content: string; mediaId?: string; mediaType?: string },
  ) {
    const content = (data.content || '').trim();
    if (!content) throw new BadRequestException('La réponse ne peut pas être vide');
    if (data.mediaId) {
      await this.mediaService.assertOwnedBy(data.mediaId, userId);
    }
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Publication introuvable');
    const comment = post.comments.find(
      (c) => (c as { _id?: Types.ObjectId })._id?.toString() === commentId,
    );
    if (!comment) throw new NotFoundException('Commentaire introuvable');
    comment.replies.push({
      userId: new Types.ObjectId(userId),
      content,
      mediaId: data.mediaId || null,
      mediaType: data.mediaType || 'text',
    } as Post['comments'][0]['replies'][0]);
    await post.save();
    await this.redis.invalidatePattern(RedisKeys.feedPattern());
    return this.enrichPost(post);
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Publication introuvable');
    if (post.authorId.toString() !== userId) throw new ForbiddenException('Non autorisé');
    await post.deleteOne();
    await this.redis.invalidatePattern(RedisKeys.feedPattern());
    return { message: 'Supprimé' };
  }

  private async enrichPost(post: PostDocument) {
    const author = await this.usersService.findById(post.authorId.toString());
    const comments = await Promise.all(
      post.comments.map(async (c) => {
        try {
          const u = await this.usersService.findById(c.userId.toString());
          const replies = await Promise.all(
            (c.replies || []).map(async (reply) => {
              try {
                const replyUser = await this.usersService.findById(reply.userId.toString());
                return {
                  id: (reply as { _id?: Types.ObjectId })._id?.toString(),
                  content: reply.content,
                  mediaId: reply.mediaId,
                  mediaType: reply.mediaType,
                  createdAt: (reply as { createdAt?: Date }).createdAt,
                  author: this.usersService.toPublic(replyUser),
                };
              } catch {
                return null;
              }
            }),
          );
          return {
            id: (c as { _id?: Types.ObjectId })._id?.toString(),
            content: c.content,
            mediaId: c.mediaId,
            mediaType: c.mediaType,
            createdAt: (c as { createdAt?: Date }).createdAt,
            author: this.usersService.toPublic(u),
            reactions: (c.reactions || []).map((r) => ({
              userId: r.userId.toString(),
              type: r.type,
            })),
            replies: replies.filter(Boolean),
          };
        } catch {
          return null;
        }
      }),
    );
    return {
      id: post._id.toString(),
      content: post.content,
      media: post.media,
      reactions: post.reactions.map((r) => ({
        userId: r.userId.toString(),
        type: r.type,
      })),
      comments: comments.filter(Boolean),
      groupId: post.groupId?.toString() || null,
      createdAt: (post as PostDocument & { createdAt?: Date }).createdAt,
      author: this.usersService.toPublic(author),
    };
  }
}
