import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { RolesService } from './roles.service';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('user-permissions')
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  getUserPermissionPlaceholder() {
    return this.rolesService.getUserPermissionPlaceholder();
  }

  @Get(':code')
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  findOne(@Param('code') code: string) {
    return this.rolesService.findOne(code);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @Patch(':code')
  @Roles('ADMIN')
  update(@Param('code') code: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.update(code, updateRoleDto);
  }

  @Delete(':code')
  @Roles('ADMIN')
  remove(@Param('code') code: string) {
    return this.rolesService.remove(code);
  }
}
