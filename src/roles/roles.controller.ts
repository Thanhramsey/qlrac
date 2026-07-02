import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { RolesService } from './roles.service';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('user-permissions')
  getUserPermissionPlaceholder() {
    return this.rolesService.getUserPermissionPlaceholder();
  }

  @Get(':code')
  findOne(@Param('code') code: string) {
    return this.rolesService.findOne(code);
  }

  @Post()
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @Patch(':code')
  update(@Param('code') code: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.update(code, updateRoleDto);
  }

  @Delete(':code')
  remove(@Param('code') code: string) {
    return this.rolesService.remove(code);
  }
}
