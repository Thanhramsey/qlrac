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
import { CreateSystemParameterDto } from './dto/create-system-parameter.dto';
import { UpdateSystemParameterDto } from './dto/update-system-parameter.dto';
import { SystemParametersService } from './system-parameters.service';

@Controller('system-parameters')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(APP_PERMISSIONS.SYSTEM_PARAMETERS_READ)
export class SystemParametersController {
  constructor(private readonly systemParametersService: SystemParametersService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('keyword') keyword?: string,
    @Query('includeInactive') includeInactive = 'false',
  ) {
    return this.systemParametersService.findAll(
      Number(page),
      Number(limit),
      keyword,
      includeInactive === 'true',
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.systemParametersService.findOne(id);
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.SYSTEM_PARAMETERS_MANAGE)
  create(@Body() dto: CreateSystemParameterDto) {
    return this.systemParametersService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(APP_PERMISSIONS.SYSTEM_PARAMETERS_MANAGE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSystemParameterDto) {
    return this.systemParametersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(APP_PERMISSIONS.SYSTEM_PARAMETERS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.systemParametersService.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions(APP_PERMISSIONS.SYSTEM_PARAMETERS_RESTORE)
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.systemParametersService.restore(id);
  }
}
