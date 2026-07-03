import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const uploadsDir = join(process.cwd(), 'uploads');
  const receiptsDir = join(uploadsDir, 'receipts');
  const avatarsDir = join(uploadsDir, 'avatars');
  if (!existsSync(receiptsDir)) {
    mkdirSync(receiptsDir, { recursive: true });
  }
  if (!existsSync(avatarsDir)) {
    mkdirSync(avatarsDir, { recursive: true });
  }

  app.use('/uploads', express.static(uploadsDir));
  app.use('/api/uploads', express.static(uploadsDir));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
