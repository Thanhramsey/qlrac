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
import { CreateWardDto } from './dto/create-ward.dto';
import { UpdateWardDto } from './dto/update-ward.dto';
import { WardsService } from './wards.service';

@Controller('wards')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(APP_PERMISSIONS.LOCATIONS_READ)
export class WardsController {
  constructor(private readonly wardsService: WardsService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('provinceId') provinceId?: string,
  ) {
    return this.wardsService.findAll(
      Number(page),
      Number(limit),
      provinceId ? Number(provinceId) : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.wardsService.findOne(id);
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.LOCATIONS_MANAGE)
  create(@Body() createWardDto: CreateWardDto) {
    return this.wardsService.create(createWardDto);
  }

  @Patch(':id')
  @RequirePermissions(APP_PERMISSIONS.LOCATIONS_MANAGE)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateWardDto: UpdateWardDto) {
    return this.wardsService.update(id, updateWardDto);
  }

  @Delete(':id')
  @RequirePermissions(APP_PERMISSIONS.LOCATIONS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.wardsService.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions(APP_PERMISSIONS.LOCATIONS_RESTORE)
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.wardsService.restore(id);
  }
}
