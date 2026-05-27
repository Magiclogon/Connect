import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Neo4jService } from '../neo4j/neo4j.service';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private neo4j: Neo4jService,
  ) {}

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).select('-password');
    if (!user) throw new NotFoundException('Utilisateur introuvable');
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
      avatarUrl?: string;
      coverUrl?: string;
      address?: string;
      city?: string;
      workplace?: string;
      website?: string;
    },
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, data, { new: true })
      .select('-password');
    if (!user) throw new NotFoundException('Utilisateur introuvable');
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
      avatarUrl: user.avatarUrl,
      coverUrl: user.coverUrl,
      address: user.address || '',
      city: user.city || '',
      workplace: user.workplace || '',
      website: user.website || '',
      createdAt: (user as UserDocument & { createdAt?: Date }).createdAt,
    };
  }
}
