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
import { HouseholdsService } from './households.service';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';

@Controller('households')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(APP_PERMISSIONS.HOUSEHOLDS_READ)
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('serviceCatalogId') serviceCatalogId?: string,
    @Query('tuyenThuRacId') tuyenThuRacId?: string,
    @Query('tenChuHo') tenChuHo?: string,
    @Query('diaChi') diaChi?: string,
    @Query('includeInactive') includeInactive = 'false',
  ) {
    return this.householdsService.findAll(
      Number(page),
      Number(limit),
      serviceCatalogId ? Number(serviceCatalogId) : undefined,
      tuyenThuRacId ? Number(tuyenThuRacId) : undefined,
      tenChuHo,
      diaChi,
      includeInactive === 'true',
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.householdsService.findOne(id);
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.HOUSEHOLDS_MANAGE)
  create(@Body() createHouseholdDto: CreateHouseholdDto) {
    return this.householdsService.create(createHouseholdDto);
  }

  @Post('import')
  @RequirePermissions(APP_PERMISSIONS.HOUSEHOLDS_IMPORT)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  importFromExcel(@UploadedFile() file?: Express.Multer.File) {
    return this.householdsService.importFromExcel(file);
  }

  @Patch(':id')
  @RequirePermissions(APP_PERMISSIONS.HOUSEHOLDS_MANAGE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateHouseholdDto: UpdateHouseholdDto,
  ) {
    return this.householdsService.update(id, updateHouseholdDto);
  }

  @Delete(':id')
  @RequirePermissions(APP_PERMISSIONS.HOUSEHOLDS_MANAGE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.householdsService.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions(APP_PERMISSIONS.HOUSEHOLDS_RESTORE)
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.householdsService.restore(id);
  }
}