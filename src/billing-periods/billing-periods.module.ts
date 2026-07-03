import { Module } from '@nestjs/common';
import { BillingPeriodsController } from './billing-periods.controller';
import { BillingPeriodsService } from './billing-periods.service';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [InvoicesModule],
  controllers: [BillingPeriodsController],
  providers: [BillingPeriodsService],
})
export class BillingPeriodsModule {}
