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
import { CreateServiceCatalogDto } from './dto/create-service-catalog.dto';
import { UpdateServiceCatalogDto } from './dto/update-service-catalog.dto';
import { ServiceCatalogsService } from './service-catalogs.service';

@Controller('service-catalogs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(APP_PERMISSIONS.SERVICE_CATALOGS_READ)
export class ServiceCatalogsController {
  constructor(private readonly serviceCatalogsService: ServiceCatalogsService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('includeInactive') includeInactive = 'false',
  ) {
    return this.serviceCatalogsService.findAll(
      Number(page),
      Number(limit),
      includeInactive === 'true',
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.serviceCatalogsService.findOne(id);
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.SERVICE_CATALOGS_MANAGE)
  create(@Body() createServiceCatalogDto: CreateServiceCatalogDto) {
    return this.serviceCatalogsService.create(createServiceCatalogDto);
  }

  @Patch(':id')
  @RequirePermissions(APP_PERMISSIONS.SERVICE_CATALOGS_MANAGE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateServiceCatalogDto: UpdateServiceCatalogDto,
  ) {
    return this.serviceCatalogsService.update(id, updateServiceCatalogDto);
  }

  @Delete(':id')
  @RequirePermissions(APP_PERMISSIONS.SERVICE_CATALOGS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.serviceCatalogsService.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions(APP_PERMISSIONS.SERVICE_CATALOGS_RESTORE)
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.serviceCatalogsService.restore(id);
  }
}
