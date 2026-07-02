import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HouseholdsModule } from './households/households.module';
import { RoutesModule } from './routes/routes.module';
import { CollectionsModule } from './collections/collections.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    HouseholdsModule,
    RoutesModule,
    CollectionsModule,
    InvoicesModule,
    UsersModule,
    RolesModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
