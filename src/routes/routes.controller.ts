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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

@Controller('routes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'ADMIN_LEVEL_2', 'STAFF')
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
  create(@Body() createRouteDto: CreateRouteDto) {
    return this.routesService.create(createRouteDto);
  }

  @Post('import')
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  importFromExcel(@UploadedFile() file?: Express.Multer.File) {
    return this.routesService.importFromExcel(file);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRouteDto: UpdateRouteDto,
  ) {
    return this.routesService.update(id, updateRouteDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.routesService.remove(id);
  }

  @Patch(':id/restore')
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.routesService.restore(id);
  }
}