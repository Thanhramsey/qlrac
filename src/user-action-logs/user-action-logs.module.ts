import { Module } from '@nestjs/common';
import { UserActionLogsController } from './user-action-logs.controller';
import { UserActionLogsService } from './user-action-logs.service';

@Module({
  controllers: [UserActionLogsController],
  providers: [UserActionLogsService],
  exports: [UserActionLogsService],
})
export class UserActionLogsModule {}
