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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { APP_PERMISSIONS } from '../auth/constants/app-permissions.constant';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateSystemParameterDto } from './dto/create-system-parameter.dto';
import { UpdateSystemParameterDto } from './dto/update-system-parameter.dto';
import { SystemParametersService } from './system-parameters.service';

@Controller('system-parameters')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(APP_PERMISSIONS.SYSTEM_PARAMETERS_READ)
export class SystemParametersController {
  constructor(private readonly systemParametersService: SystemParametersService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('keyword') keyword?: string,
    @Query('includeInactive') includeInactive = 'false',
  ) {
    return this.systemParametersService.findAll(
      Number(page),
      Number(limit),
      keyword,
      includeInactive === 'true',
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.systemParametersService.findOne(id);
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.SYSTEM_PARAMETERS_MANAGE)
  create(@Body() dto: CreateSystemParameterDto) {
    return this.systemParametersService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(APP_PERMISSIONS.SYSTEM_PARAMETERS_MANAGE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSystemParameterDto) {
    return this.systemParametersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(APP_PERMISSIONS.SYSTEM_PARAMETERS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.systemParametersService.remove(id);
  }

  @Post(':id/upload')
  @RequirePermissions(APP_PERMISSIONS.SYSTEM_PARAMETERS_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'parameters'),
        filename: (_req, file, cb) => {
          const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `param-${suffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async uploadFile(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file để upload');
    }
    const fileUrl = `/uploads/parameters/${file.filename}`;
    return this.systemParametersService.update(id, { giaTri: fileUrl });
  }

  @Patch(':id/restore')
  @RequirePermissions(APP_PERMISSIONS.SYSTEM_PARAMETERS_RESTORE)
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.systemParametersService.restore(id);
  }
}
