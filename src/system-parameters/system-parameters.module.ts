import { Module } from '@nestjs/common';
import { SystemParametersController } from './system-parameters.controller';
import { SystemParametersService } from './system-parameters.service';

@Module({
  controllers: [SystemParametersController],
  providers: [SystemParametersService],
})
export class SystemParametersModule {}
