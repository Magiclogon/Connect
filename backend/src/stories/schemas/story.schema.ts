import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StoryDocument = Story & Document;

@Schema({ timestamps: true })
export class Story {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  authorId: Types.ObjectId;

  @Prop({ required: true, enum: ['image', 'video', 'text'] })
  type: string;

  @Prop({ default: '' })
  mediaUrl: string;

  @Prop({ default: '' })
  text: string;

  @Prop({ default: '' })
  backgroundColor: string;

  @Prop({ required: true })
  expiresAt: Date;
}

export const StorySchema = SchemaFactory.createForClass(Story);
StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
