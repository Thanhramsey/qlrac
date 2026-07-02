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
import { CreateServiceCatalogDto } from './dto/create-service-catalog.dto';
import { UpdateServiceCatalogDto } from './dto/update-service-catalog.dto';
import { ServiceCatalogsService } from './service-catalogs.service';

@Controller('service-catalogs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'ADMIN_LEVEL_2')
export class ServiceCatalogsController {
  constructor(private readonly serviceCatalogsService: ServiceCatalogsService) {}

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.serviceCatalogsService.findAll(Number(page), Number(limit));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.serviceCatalogsService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() createServiceCatalogDto: CreateServiceCatalogDto) {
    return this.serviceCatalogsService.create(createServiceCatalogDto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateServiceCatalogDto: UpdateServiceCatalogDto,
  ) {
    return this.serviceCatalogsService.update(id, updateServiceCatalogDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.serviceCatalogsService.remove(id);
  }
}
