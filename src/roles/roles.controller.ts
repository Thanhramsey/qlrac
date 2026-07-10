import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { APP_PERMISSIONS } from '../auth/constants/app-permissions.constant';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateRoleDto } from './dto/create-role.dto';
import { RolesService } from './roles.service';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions(APP_PERMISSIONS.ROLES_READ)
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('user-permissions')
  @RequirePermissions(APP_PERMISSIONS.ROLES_READ)
  getUserPermissionPlaceholder() {
    return this.rolesService.getUserPermissionPlaceholder();
  }

  @Get('permissions')
  @RequirePermissions(APP_PERMISSIONS.ROLES_READ)
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Get(':code/permissions')
  @RequirePermissions(APP_PERMISSIONS.ROLES_READ)
  getRolePermissions(@Param('code') code: string) {
    return this.rolesService.getRolePermissions(code);
  }

  @Put(':code/permissions')
  @RequirePermissions(APP_PERMISSIONS.ROLES_PERMISSION_MANAGE)
  updateRolePermissions(
    @Req() req: Request & { user?: JwtPayload },
    @Param('code') code: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rolesService.updateRolePermissions(code, dto.permissionCodes, req.user);
  }

  @Get(':code')
  @RequirePermissions(APP_PERMISSIONS.ROLES_READ)
  findOne(@Param('code') code: string) {
    return this.rolesService.findOne(code);
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.ROLES_MANAGE)
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @Patch(':code')
  @RequirePermissions(APP_PERMISSIONS.ROLES_MANAGE)
  update(@Param('code') code: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.update(code, updateRoleDto);
  }

  @Delete(':code')
  @RequirePermissions(APP_PERMISSIONS.ROLES_MANAGE)
  remove(@Param('code') code: string) {
    return this.rolesService.remove(code);
  }

  @Patch(':code/restore')
  @RequirePermissions(APP_PERMISSIONS.ROLES_MANAGE)
  restore(@Param('code') code: string) {
    return this.rolesService.restore(code);
  }
}
