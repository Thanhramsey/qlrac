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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { UpdateRoleMenusDto } from './dto/update-role-menus.dto';
import { MenusService } from './menus.service';

@Controller('menus')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  findAll() {
    return this.menusService.findAll();
  }

  @Get('tree')
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  findTree() {
    return this.menusService.findTree();
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() createMenuDto: CreateMenuDto) {
    return this.menusService.create(createMenuDto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateMenuDto: UpdateMenuDto) {
    return this.menusService.update(id, updateMenuDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.menusService.remove(id);
  }

  @Get('role/:roleCode')
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  getRoleMenus(@Param('roleCode') roleCode: string) {
    return this.menusService.getRoleMenuIds(roleCode);
  }

  @Put('role/:roleCode')
  @Roles('ADMIN')
  updateRoleMenus(
    @Param('roleCode') roleCode: string,
    @Body() updateRoleMenusDto: UpdateRoleMenusDto,
  ) {
    return this.menusService.updateRoleMenus(roleCode, updateRoleMenusDto.menuIds);
  }
}
