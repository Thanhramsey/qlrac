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

  // 🎯 BẬT CỜ NÀY ĐỂ FIX LỖI CORS: Cho phép tất cả các nguồn kết nối tới API
  app.enableCors({
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Dòng cấu hình cổng hôm nọ tụi mình sửa
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
