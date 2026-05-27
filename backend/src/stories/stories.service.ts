import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FriendsService } from '../friends/friends.service';
import { UsersService } from '../users/users.service';
import { Story, StoryDocument } from './schemas/story.schema';

@Injectable()
export class StoriesService {
  constructor(
    @InjectModel(Story.name) private storyModel: Model<StoryDocument>,
    private friendsService: FriendsService,
    private usersService: UsersService,
  ) {}

  async create(
    authorId: string,
    data: { type: string; mediaUrl?: string; text?: string; backgroundColor?: string },
  ) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const story = await this.storyModel.create({
      authorId: new Types.ObjectId(authorId),
      type: data.type,
      mediaUrl: data.mediaUrl || '',
      text: data.text || '',
      backgroundColor: data.backgroundColor || '#6366f1',
      expiresAt,
    });
    return this.enrichStory(story);
  }

  async getFeed(userId: string) {
    const friendIds = await this.friendsService.getFriendIds(userId);
    const authorIds = [userId, ...friendIds].map((id) => new Types.ObjectId(id));
    const now = new Date();
    const stories = await this.storyModel
      .find({ authorId: { $in: authorIds }, expiresAt: { $gt: now } })
      .sort({ createdAt: -1 });

    const grouped = new Map<string, StoryDocument[]>();
    for (const s of stories) {
      const key = s.authorId.toString();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(s);
    }

    const result = await Promise.all(
      Array.from(grouped.entries()).map(async ([authorId, items]) => {
        const author = await this.usersService.findById(authorId);
        return {
          author: this.usersService.toPublic(author),
          stories: await Promise.all(items.map((s) => this.enrichStory(s))),
        };
      }),
    );
    return result;
  }

  private async enrichStory(story: StoryDocument) {
    const author = await this.usersService.findById(story.authorId.toString());
    return {
      id: story._id.toString(),
      type: story.type,
      mediaUrl: story.mediaUrl,
      text: story.text,
      backgroundColor: story.backgroundColor,
      expiresAt: story.expiresAt,
      createdAt: (story as StoryDocument & { createdAt?: Date }).createdAt,
      author: this.usersService.toPublic(author),
    };
  }
}
