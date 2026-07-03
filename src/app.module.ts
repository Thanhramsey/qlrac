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
import { SecurityModule } from './auth/security.module';
import { ProvincesModule } from './provinces/provinces.module';
import { WardsModule } from './wards/wards.module';
import { LocalitiesModule } from './localities/localities.module';
import { ServiceCatalogsModule } from './service-catalogs/service-catalogs.module';
import { MenusModule } from './menus/menus.module';
import { BillingPeriodsModule } from './billing-periods/billing-periods.module';
import { SystemParametersModule } from './system-parameters/system-parameters.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    PrismaModule,
    SecurityModule,
    HouseholdsModule,
    RoutesModule,
    CollectionsModule,
    InvoicesModule,
    UsersModule,
    RolesModule,
    ProvincesModule,
    WardsModule,
    LocalitiesModule,
    ServiceCatalogsModule,
    BillingPeriodsModule,
    SystemParametersModule,
    DashboardModule,
    MenusModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
