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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BillingPeriodsService } from './billing-periods.service';
import { CreateBillingPeriodDto } from './dto/create-billing-period.dto';
import { UpdateBillingPeriodDto } from './dto/update-billing-period.dto';
import { UpdateBillingPeriodConfigDto } from './dto/update-billing-period-config.dto';

@Controller('billing-periods')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT')
export class BillingPeriodsController {
  constructor(private readonly billingPeriodsService: BillingPeriodsService) {}

  @Get()
  @Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT', 'STAFF')
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
  @Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT', 'STAFF')
  getConfig() {
    return this.billingPeriodsService.getConfig();
  }

  @Get(':id')
  @Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT', 'STAFF')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.billingPeriodsService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  create(@Body() dto: CreateBillingPeriodDto) {
    return this.billingPeriodsService.create(dto);
  }

  @Patch('config')
  @Roles('ADMIN')
  updateConfig(@Body() dto: UpdateBillingPeriodConfigDto) {
    return this.billingPeriodsService.updateConfig(dto);
  }

  @Post('auto-generate-now')
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  runAutoCreateNow() {
    return this.billingPeriodsService.runAutoCreateNow();
  }

  @Patch(':id')
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBillingPeriodDto) {
    return this.billingPeriodsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.billingPeriodsService.remove(id);
  }

  @Patch(':id/restore')
  @Roles('ADMIN')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.billingPeriodsService.restore(id);
  }
}
