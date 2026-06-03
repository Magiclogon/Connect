import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PostDocument = Post & Document;

export type MediaType = 'text' | 'image' | 'video';

@Schema({ _id: false })
export class MediaItem {
  @Prop({ required: true, enum: ['text', 'image', 'video'] })
  type: MediaType;

  @Prop({ type: String, default: null })
  mediaId: string | null;

  @Prop({ default: '' })
  text: string;
}

@Schema({ _id: false })
export class Reaction {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'] })
  type: string;
}

@Schema({ _id: true, timestamps: true })
export class CommentReaction {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'] })
  type: string;
}

@Schema({ _id: true, timestamps: true })
export class CommentReply {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ type: String, default: null })
  mediaId: string | null;

  @Prop({ enum: ['text', 'image', 'video'], default: 'text' })
  mediaType: string;
}

@Schema({ _id: true, timestamps: true })
export class Comment {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ type: String, default: null })
  mediaId: string | null;

  @Prop({ enum: ['text', 'image', 'video'], default: 'text' })
  mediaType: string;

  @Prop({ type: [CommentReaction], default: [] })
  reactions: CommentReaction[];

  @Prop({ type: [CommentReply], default: [] })
  replies: CommentReply[];
}

@Schema({ timestamps: true })
export class Post {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  authorId: Types.ObjectId;

  @Prop({ type: [MediaItem], default: [] })
  media: MediaItem[];

  @Prop({ default: '' })
  content: string;

  @Prop({ type: [Reaction], default: [] })
  reactions: Reaction[];

  @Prop({ type: [Comment], default: [] })
  comments: Comment[];

  @Prop({ type: Types.ObjectId, default: null })
  groupId: Types.ObjectId | null;
}

export const PostSchema = SchemaFactory.createForClass(Post);
