import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { APP_PERMISSIONS } from '../auth/constants/app-permissions.constant';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

@Controller('routes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(APP_PERMISSIONS.ROUTES_READ)
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('localityId') localityId?: string,
    @Query('staffId') staffId?: string,
    @Query('includeInactive') includeInactive = 'false',
  ) {
    return this.routesService.findAll(
      Number(page),
      Number(limit),
      localityId ? Number(localityId) : undefined,
      staffId ? Number(staffId) : undefined,
      includeInactive === 'true',
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.routesService.findOne(id);
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.ROUTES_MANAGE)
  create(@Body() createRouteDto: CreateRouteDto) {
    return this.routesService.create(createRouteDto);
  }

  @Post('import')
  @RequirePermissions(APP_PERMISSIONS.ROUTES_IMPORT)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  importFromExcel(@UploadedFile() file?: Express.Multer.File) {
    return this.routesService.importFromExcel(file);
  }

  @Patch(':id')
  @RequirePermissions(APP_PERMISSIONS.ROUTES_MANAGE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRouteDto: UpdateRouteDto,
  ) {
    return this.routesService.update(id, updateRouteDto);
  }

  @Delete(':id')
  @RequirePermissions(APP_PERMISSIONS.ROUTES_MANAGE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.routesService.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions(APP_PERMISSIONS.ROUTES_RESTORE)
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.routesService.restore(id);
  }
}