import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SecurityModule } from './security.module';

@Module({
  imports: [SecurityModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
