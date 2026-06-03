import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Neo4jService } from '../neo4j/neo4j.service';
import { RedisKeys, RedisTTL } from '../redis/redis-keys';
import { RedisService } from '../redis/redis.service';
import { MediaService } from '../media/media.service';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private neo4j: Neo4jService,
    private redis: RedisService,
    private mediaService: MediaService,
  ) {}

  async findById(id: string): Promise<UserDocument> {
    const cacheKey = RedisKeys.userProfile(id);
    const cached = await this.redis.getJson<UserDocument>(cacheKey);
    if (cached) {
      return this.userModel.hydrate(cached) as UserDocument;
    }

    const user = await this.userModel.findById(id).select('-password');
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const plain = user.toObject();
    await this.redis.setJson(cacheKey, plain, RedisTTL.userProfile);
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }

  async create(data: Partial<User>): Promise<UserDocument> {
    const user = await this.userModel.create(data);
    await this.neo4j.run(
      `MERGE (u:User {id: $id})
       SET u.displayName = $displayName, u.email = $email, u.createdAt = datetime()`,
      { id: user._id.toString(), displayName: user.displayName, email: user.email },
    );
    return user;
  }

  async updateProfile(
    userId: string,
    data: {
      displayName?: string;
      bio?: string;
      avatarMediaId?: string | null;
      coverMediaId?: string | null;
      address?: string;
      city?: string;
      workplace?: string;
      website?: string;
    },
  ): Promise<UserDocument> {
    if (data.avatarMediaId) {
      await this.mediaService.assertOwnedBy(data.avatarMediaId, userId);
    }
    if (data.coverMediaId) {
      await this.mediaService.assertOwnedBy(data.coverMediaId, userId);
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, data, { new: true })
      .select('-password');
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    await this.redis.del(RedisKeys.userProfile(userId));
    await this.redis.invalidatePattern(RedisKeys.feedPattern(userId));

    if (data.displayName) {
      await this.neo4j.run(`MATCH (u:User {id: $id}) SET u.displayName = $displayName`, {
        id: userId,
        displayName: data.displayName,
      });
    }
    return user;
  }

  async search(query: string, excludeId?: string): Promise<UserDocument[]> {
    const filter: Record<string, unknown> = {
      $or: [
        { displayName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
    };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.userModel.find(filter).select('-password').limit(20);
  }

  toPublic(user: UserDocument) {
    return {
      id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      bio: user.bio,
      avatarMediaId: user.avatarMediaId || null,
      coverMediaId: user.coverMediaId || null,
      address: user.address || '',
      city: user.city || '',
      workplace: user.workplace || '',
      website: user.website || '',
      createdAt: (user as UserDocument & { createdAt?: Date }).createdAt,
    };
  }
}
