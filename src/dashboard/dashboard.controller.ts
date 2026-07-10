import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { APP_PERMISSIONS } from '../auth/constants/app-permissions.constant';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(APP_PERMISSIONS.DASHBOARD_READ)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  getOverview(@Query('kyHoaDon') kyHoaDon?: string | string[]) {
    return this.dashboardService.getOverview(kyHoaDon);
  }
}
