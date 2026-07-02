import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SecurityModule } from './security.module';
import { MenusModule } from '../menus/menus.module';

@Module({
  imports: [SecurityModule, MenusModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
