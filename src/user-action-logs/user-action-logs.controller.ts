import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { QueryUserActionLogDto } from './dto/query-user-action-log.dto';
import { UserActionLogsService } from './user-action-logs.service';

@Controller('user-action-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'ADMIN_LEVEL_2')
export class UserActionLogsController {
  constructor(private readonly userActionLogsService: UserActionLogsService) {}

  @Get()
  findAll(@Query() query: QueryUserActionLogDto) {
    return this.userActionLogsService.findAll(query);
  }
}
