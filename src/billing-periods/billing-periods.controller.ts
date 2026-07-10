import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { APP_PERMISSIONS } from '../auth/constants/app-permissions.constant';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { BillingPeriodsService } from './billing-periods.service';
import { CreateBillingPeriodDto } from './dto/create-billing-period.dto';
import { UpdateBillingPeriodDto } from './dto/update-billing-period.dto';
import { UpdateBillingPeriodConfigDto } from './dto/update-billing-period-config.dto';

@Controller('billing-periods')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(APP_PERMISSIONS.BILLING_PERIODS_READ)
export class BillingPeriodsController {
  constructor(private readonly billingPeriodsService: BillingPeriodsService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('includeInactive') includeInactive = 'false',
  ) {
    return this.billingPeriodsService.findAll(
      Number(page),
      Number(limit),
      includeInactive === 'true',
    );
  }

  @Get('config')
  getConfig() {
    return this.billingPeriodsService.getConfig();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.billingPeriodsService.findOne(id);
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.BILLING_PERIODS_MANAGE)
  create(@Body() dto: CreateBillingPeriodDto) {
    return this.billingPeriodsService.create(dto);
  }

  @Patch('config')
  @RequirePermissions(APP_PERMISSIONS.BILLING_PERIODS_CONFIG)
  updateConfig(@Body() dto: UpdateBillingPeriodConfigDto) {
    return this.billingPeriodsService.updateConfig(dto);
  }

  @Post('auto-generate-now')
  @RequirePermissions(APP_PERMISSIONS.BILLING_PERIODS_MANAGE)
  runAutoCreateNow() {
    return this.billingPeriodsService.runAutoCreateNow();
  }

  @Patch(':id')
  @RequirePermissions(APP_PERMISSIONS.BILLING_PERIODS_MANAGE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBillingPeriodDto) {
    return this.billingPeriodsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(APP_PERMISSIONS.BILLING_PERIODS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.billingPeriodsService.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions(APP_PERMISSIONS.BILLING_PERIODS_RESTORE)
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.billingPeriodsService.restore(id);
  }
}
