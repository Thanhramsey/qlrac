import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { APP_PERMISSIONS } from '../auth/constants/app-permissions.constant';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { UpdateRoleMenusDto } from './dto/update-role-menus.dto';
import { MenusService } from './menus.service';

@Controller('menus')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Get('my')
  async findMyMenus(@Req() req: Request) {
    const user = (req as Request & { user?: JwtPayload }).user;
    if (!user?.role) {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    const menus = await this.menusService.getMobileClientMenusByRole(user.role);
    return {
      roleCode: user.role,
      menus,
    };
  }

  @Get()
  @RequirePermissions(APP_PERMISSIONS.MENUS_READ)
  findAll() {
    return this.menusService.findAll();
  }

  @Get('tree')
  @RequirePermissions(APP_PERMISSIONS.MENUS_READ)
  findTree() {
    return this.menusService.findTree();
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.MENUS_MANAGE)
  create(@Body() createMenuDto: CreateMenuDto) {
    return this.menusService.create(createMenuDto);
  }

  @Patch(':id')
  @RequirePermissions(APP_PERMISSIONS.MENUS_MANAGE)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateMenuDto: UpdateMenuDto) {
    return this.menusService.update(id, updateMenuDto);
  }

  @Delete(':id')
  @RequirePermissions(APP_PERMISSIONS.MENUS_MANAGE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.menusService.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions(APP_PERMISSIONS.MENUS_MANAGE)
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.menusService.restore(id);
  }

  @Get('role/:roleCode')
  @RequirePermissions(APP_PERMISSIONS.MENUS_ASSIGN)
  getRoleMenus(@Param('roleCode') roleCode: string) {
    return this.menusService.getRoleMenuIds(roleCode);
  }

  @Put('role/:roleCode')
  @RequirePermissions(APP_PERMISSIONS.MENUS_ASSIGN)
  updateRoleMenus(
    @Param('roleCode') roleCode: string,
    @Body() updateRoleMenusDto: UpdateRoleMenusDto,
  ) {
    return this.menusService.updateRoleMenus(roleCode, updateRoleMenusDto.menuIds);
  }
}
