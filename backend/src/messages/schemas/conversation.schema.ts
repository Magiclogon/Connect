import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ _id: false })
export class Message {
  @Prop({ type: Types.ObjectId, required: true })
  senderId: Types.ObjectId;

  @Prop({ required: true, enum: ['text', 'image', 'video'] })
  type: string;

  @Prop({ default: '' })
  content: string;

  @Prop({ default: '' })
  mediaUrl: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: false })
  read: boolean;
}

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: [Types.ObjectId], required: true })
  participants: Types.ObjectId[];

  @Prop({ type: [Message], default: [] })
  messages: Message[];

  @Prop({ default: false })
  isGroup: boolean;

  @Prop({ default: '' })
  groupName: string;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ participants: 1 });
