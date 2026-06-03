import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Media, MediaSchema } from './schemas/media.schema';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { GridFsStorageService } from './gridfs-storage.service';
import { MulterExceptionFilter } from '../common/filters/multer-exception.filter';

@Module({
  imports: [MongooseModule.forFeature([{ name: Media.name, schema: MediaSchema }])],
  controllers: [MediaController],
  providers: [MediaService, GridFsStorageService, MulterExceptionFilter],
  exports: [MediaService],
})
export class MediaModule {}
