import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-jwt-secret',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as
          | `${number}${'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y'}`
          | number,
      },
    }),
  ],
  providers: [JwtAuthGuard, RolesGuard, PermissionsGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, PermissionsGuard],
})
export class SecurityModule {}