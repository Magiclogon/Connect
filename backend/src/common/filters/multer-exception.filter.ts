import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';
import { MAX_UPLOAD_LABEL } from '../../media/media.constants';

@Catch(MulterError, BadRequestException)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError | BadRequestException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof MulterError && exception.code === 'LIMIT_FILE_SIZE') {
      const body = new PayloadTooLargeException(
        `Fichier trop volumineux (max ${MAX_UPLOAD_LABEL})`,
      ).getResponse();
      return res.status(HttpStatus.PAYLOAD_TOO_LARGE).json(body);
    }

    if (exception instanceof BadRequestException) {
      const status = exception.getStatus();
      return res.status(status).json(exception.getResponse());
    }

    const body = {
      statusCode: HttpStatus.BAD_REQUEST,
      message: exception.message || 'Erreur de téléversement',
    };
    res.status(HttpStatus.BAD_REQUEST).json(body);
  }
}
