import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { unlink } from 'fs/promises';
import { Readable } from 'stream';
import { RedisKeys, RedisTTL } from '../redis/redis-keys';
import { RedisService } from '../redis/redis.service';
import { isValidMediaId } from './media.util';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from './media.constants';
import { GridFsStorageService } from './gridfs-storage.service';
import { Media, MediaDocument } from './schemas/media.schema';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectModel(Media.name) private mediaModel: Model<MediaDocument>,
    private redis: RedisService,
    private gridFs: GridFsStorageService,
  ) {}

  async saveFromUpload(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ mediaId: string; contentType: string; size: number }> {
    if (!file) {
      throw new BadRequestException('Aucun fichier');
    }
    const size = file.size ?? file.buffer?.length ?? 0;
    if (!size) {
      throw new BadRequestException('Fichier vide');
    }
    if (size > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException(`Fichier trop volumineux (max ${MAX_UPLOAD_LABEL})`);
    }

    const metadata = {
      uploadedBy: userId,
      contentType: file.mimetype,
    };

    let gridFsFileId: Types.ObjectId;
    try {
      if (file.path) {
        gridFsFileId = await this.gridFs.uploadFromPath(file.path, file.originalname, metadata);
      } else if (file.buffer?.length) {
        gridFsFileId = await this.gridFs.uploadFromBuffer(file.buffer, file.originalname, metadata);
      } else {
        throw new BadRequestException('Fichier illisible');
      }
    } catch (err) {
      this.logger.error('GridFS upload failed', err);
      throw new InternalServerErrorException(
        'Échec de l’enregistrement du fichier. Réessayez avec une vidéo plus courte ou un format MP4/WebM.',
      );
    } finally {
      if (file.path) {
        await unlink(file.path).catch(() => undefined);
      }
    }

    try {
      const doc = await this.mediaModel.create({
        gridFsFileId,
        contentType: file.mimetype,
        filename: file.originalname,
        size,
        uploadedBy: new Types.ObjectId(userId),
      });

      const mediaId = doc._id.toString();
      await this.redis.setJson(
        RedisKeys.mediaMeta(mediaId),
        { contentType: doc.contentType, size: doc.size, filename: doc.filename },
        RedisTTL.mediaMeta,
      );

      return { mediaId, contentType: doc.contentType, size: doc.size };
    } catch (err) {
      this.logger.error('Media metadata save failed', err);
      throw new InternalServerErrorException('Échec de l’enregistrement des métadonnées du média');
    }
  }

  async getById(mediaId: string): Promise<MediaDocument> {
    if (!isValidMediaId(mediaId)) {
      throw new NotFoundException('Média introuvable');
    }
    const media = await this.mediaModel.findById(mediaId);
    if (!media) throw new NotFoundException('Média introuvable');
    return media;
  }

  openReadStream(media: MediaDocument) {
    if (this.gridFs.hasInlineData(media.data)) {
      return Readable.from(media.data!);
    }
    if (media.gridFsFileId) {
      return this.gridFs.openDownloadStream(media.gridFsFileId);
    }
    throw new NotFoundException('Contenu média introuvable');
  }

  async getMetadata(mediaId: string) {
    const cached = await this.redis.getJson<{ contentType: string; size: number; filename: string }>(
      RedisKeys.mediaMeta(mediaId),
    );
    if (cached) return cached;

    const media = await this.getById(mediaId);
    const meta = {
      contentType: media.contentType,
      size: media.size,
      filename: media.filename,
    };
    await this.redis.setJson(RedisKeys.mediaMeta(mediaId), meta, RedisTTL.mediaMeta);
    return meta;
  }

  async assertOwnedBy(mediaId: string, userId: string): Promise<void> {
    const media = await this.getById(mediaId);
    if (media.uploadedBy.toString() !== userId) {
      throw new BadRequestException('Média non autorisé');
    }
  }

}
