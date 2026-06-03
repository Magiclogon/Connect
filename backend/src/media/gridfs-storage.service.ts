import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { GridFSBucket } from 'mongodb';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { GRIDFS_BUCKET } from './media.constants';

@Injectable()
export class GridFsStorageService {
  constructor(@InjectConnection() private connection: Connection) {}

  private bucket(): GridFSBucket {
    const db = this.connection.db;
    if (!db) {
      throw new Error('MongoDB connection not ready');
    }
    return new GridFSBucket(db, { bucketName: GRIDFS_BUCKET });
  }

  uploadFromPath(
    filePath: string,
    filename: string,
    metadata: Record<string, unknown>,
  ): Promise<Types.ObjectId> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.bucket().openUploadStream(filename, { metadata });
      createReadStream(filePath)
        .pipe(uploadStream)
        .on('error', reject)
        .on('finish', () => resolve(uploadStream.id as Types.ObjectId));
    });
  }

  uploadFromBuffer(
    buffer: Buffer,
    filename: string,
    metadata: Record<string, unknown>,
  ): Promise<Types.ObjectId> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.bucket().openUploadStream(filename, { metadata });
      Readable.from(buffer)
        .pipe(uploadStream)
        .on('error', reject)
        .on('finish', () => resolve(uploadStream.id as Types.ObjectId));
    });
  }

  openDownloadStream(gridFsFileId: Types.ObjectId | string) {
    const id = typeof gridFsFileId === 'string' ? new Types.ObjectId(gridFsFileId) : gridFsFileId;
    return this.bucket().openDownloadStream(id);
  }

  hasInlineData(data: Buffer | undefined | null): boolean {
    return Boolean(data && data.length > 0);
  }
}
