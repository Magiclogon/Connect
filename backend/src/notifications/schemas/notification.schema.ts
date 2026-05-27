import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  actorId: Types.ObjectId;

  @Prop({ required: true, enum: ['like', 'comment', 'message', 'friend_request'] })
  type: string;

  @Prop({ default: '' })
  message: string;

  @Prop({ type: Types.ObjectId, default: null })
  postId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  conversationId: Types.ObjectId | null;

  @Prop({ default: false })
  read: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, createdAt: -1 });
