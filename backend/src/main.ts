import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { MAX_UPLOAD_LABEL } from './media/media.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    credentials: true,
  });

  // Multer errors (e.g. LIMIT_FILE_SIZE) before Nest exception layer
  app.use((err: Error & { code?: string }, _req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }, next: (e?: Error) => void) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        statusCode: 413,
        message: `Fichier trop volumineux (max ${MAX_UPLOAD_LABEL})`,
      });
    }
    if (err?.message === 'Type de fichier non autorisé') {
      return res.status(400).json({ statusCode: 400, message: err.message });
    }
    next(err);
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
