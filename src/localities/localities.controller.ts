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
import { CreateLocalityDto } from './dto/create-locality.dto';
import { UpdateLocalityDto } from './dto/update-locality.dto';
import { LocalitiesService } from './localities.service';

@Controller('localities')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(APP_PERMISSIONS.LOCATIONS_READ)
export class LocalitiesController {
  constructor(private readonly localitiesService: LocalitiesService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('wardId') wardId?: string,
  ) {
    return this.localitiesService.findAll(
      Number(page),
      Number(limit),
      wardId ? Number(wardId) : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.localitiesService.findOne(id);
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.LOCATIONS_MANAGE)
  create(@Body() createLocalityDto: CreateLocalityDto) {
    return this.localitiesService.create(createLocalityDto);
  }

  @Patch(':id')
  @RequirePermissions(APP_PERMISSIONS.LOCATIONS_MANAGE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLocalityDto: UpdateLocalityDto,
  ) {
    return this.localitiesService.update(id, updateLocalityDto);
  }

  @Delete(':id')
  @RequirePermissions(APP_PERMISSIONS.LOCATIONS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.localitiesService.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions(APP_PERMISSIONS.LOCATIONS_RESTORE)
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.localitiesService.restore(id);
  }
}
