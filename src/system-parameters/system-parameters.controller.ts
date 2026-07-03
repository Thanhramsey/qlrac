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
import { CreateSystemParameterDto } from './dto/create-system-parameter.dto';
import { UpdateSystemParameterDto } from './dto/update-system-parameter.dto';
import { SystemParametersService } from './system-parameters.service';

@Controller('system-parameters')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'ADMIN_LEVEL_2')
export class SystemParametersController {
  constructor(private readonly systemParametersService: SystemParametersService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('keyword') keyword?: string,
  ) {
    return this.systemParametersService.findAll(Number(page), Number(limit), keyword);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.systemParametersService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateSystemParameterDto) {
    return this.systemParametersService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSystemParameterDto) {
    return this.systemParametersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.systemParametersService.remove(id);
  }
}
