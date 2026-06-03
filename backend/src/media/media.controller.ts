import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MAX_UPLOAD_BYTES } from './media.constants';
import { MulterExceptionFilter } from '../common/filters/multer-exception.filter';
import { MediaService } from './media.service';

const allowed = /jpeg|jpg|png|gif|webp|mp4|webm|mov|pdf|quicktime/i;

@Controller()
export class MediaController {
  constructor(private mediaService: MediaService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, tmpdir()),
        filename: (_req, file, cb) => {
          cb(null, `${uuidv4()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase().slice(1);
        if (allowed.test(ext) || allowed.test(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Type de fichier non autorisé'), false);
        }
      },
    }),
  )
  upload(
    @CurrentUser() user: { userId: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.mediaService.saveFromUpload(user.userId, file);
  }

  @Get('media/:id')
  async serve(@Param('id') id: string, @Res() res: Response) {
    const media = await this.mediaService.getById(id);
    res.setHeader('Content-Type', media.contentType);
    res.setHeader('Content-Length', String(media.size));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');

    const stream = this.mediaService.openReadStream(media);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).json({ message: 'Média introuvable' });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  }
}
