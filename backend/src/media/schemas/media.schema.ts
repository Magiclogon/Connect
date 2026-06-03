import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MediaDocument = Media & Document;

@Schema({ timestamps: true })
export class Media {
  /** Legacy: small files stored inline (pre-GridFS). New uploads use gridFsFileId only. */
  @Prop({ type: Buffer })
  data?: Buffer;

  @Prop({ type: Types.ObjectId })
  gridFsFileId?: Types.ObjectId;

  @Prop({ required: true })
  contentType: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  size: number;

  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  uploadedBy: Types.ObjectId;
}

export const MediaSchema = SchemaFactory.createForClass(Media);
