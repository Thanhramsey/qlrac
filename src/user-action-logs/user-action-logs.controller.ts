import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { APP_PERMISSIONS } from '../auth/constants/app-permissions.constant';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { QueryUserActionLogDto } from './dto/query-user-action-log.dto';
import { UserActionLogsService } from './user-action-logs.service';

@Controller('user-action-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(APP_PERMISSIONS.USER_ACTION_LOGS_READ)
export class UserActionLogsController {
  constructor(private readonly userActionLogsService: UserActionLogsService) {}

  @Get()
  findAll(@Query() query: QueryUserActionLogDto) {
    return this.userActionLogsService.findAll(query);
  }
}
