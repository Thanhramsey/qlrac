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
import { HouseholdsService } from './households.service';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';

@Controller('households')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'ADMIN_LEVEL_2', 'STAFF')
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
  create(@Body() createHouseholdDto: CreateHouseholdDto) {
    return this.householdsService.create(createHouseholdDto);
  }

  @Post('import')
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  importFromExcel(@UploadedFile() file?: Express.Multer.File) {
    return this.householdsService.importFromExcel(file);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateHouseholdDto: UpdateHouseholdDto,
  ) {
    return this.householdsService.update(id, updateHouseholdDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.householdsService.remove(id);
  }

  @Patch(':id/restore')
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.householdsService.restore(id);
  }
}