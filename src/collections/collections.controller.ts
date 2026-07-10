import { APP_PERMISSIONS } from '../auth/constants/app-permissions.constant';
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
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@Controller('collections')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(APP_PERMISSIONS.COLLECTIONS_READ)
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.collectionsService.findAll(Number(page), Number(limit));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.collectionsService.findOne(id);
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.COLLECTIONS_MANAGE)
  create(@Body() createCollectionDto: CreateCollectionDto) {
    return this.collectionsService.create(createCollectionDto);
  }

  @Patch(':id')
  @RequirePermissions(APP_PERMISSIONS.COLLECTIONS_MANAGE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCollectionDto: UpdateCollectionDto,
  ) {
    return this.collectionsService.update(id, updateCollectionDto);
  }

  @Delete(':id')
  @RequirePermissions(APP_PERMISSIONS.COLLECTIONS_MANAGE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.collectionsService.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions(APP_PERMISSIONS.COLLECTIONS_RESTORE)
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.collectionsService.restore(id);
  }
}