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
import { CreateLocalityDto } from './dto/create-locality.dto';
import { UpdateLocalityDto } from './dto/update-locality.dto';
import { LocalitiesService } from './localities.service';

@Controller('localities')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'ADMIN_LEVEL_2')
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
  @Roles('ADMIN')
  create(@Body() createLocalityDto: CreateLocalityDto) {
    return this.localitiesService.create(createLocalityDto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLocalityDto: UpdateLocalityDto,
  ) {
    return this.localitiesService.update(id, updateLocalityDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.localitiesService.remove(id);
  }
}
