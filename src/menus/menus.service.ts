import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const menus = await this.prisma.menu.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    return this.buildTree(menus);
  }

  async findTree() {
    const menus = await this.prisma.menu.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    return this.buildTree(menus);
  }

  async create(createMenuDto: CreateMenuDto) {
    const menuKey = createMenuDto.menuKey?.trim();
    const tenMenu = createMenuDto.tenMenu?.trim();

    if (!menuKey) {
      throw new BadRequestException('Mã menu là bắt buộc');
    }

    if (!tenMenu) {
      throw new BadRequestException('Tên menu là bắt buộc');
    }

    if (createMenuDto.parentId) {
      await this.ensureParentExists(createMenuDto.parentId);
    }

    const created = await this.prisma.menu.create({
      data: {
        menuKey,
        tenMenu,
        routePath: createMenuDto.routePath?.trim() || null,
        parentId: createMenuDto.parentId ?? null,
        sortOrder: createMenuDto.sortOrder ?? 0,
        isActive: createMenuDto.isActive ?? true,
      },
    });

    return created;
  }

  async update(id: number, updateMenuDto: UpdateMenuDto) {
    const existing = await this.findOne(id);

    if (updateMenuDto.parentId !== undefined && updateMenuDto.parentId !== null) {
      if (updateMenuDto.parentId === id) {
        throw new BadRequestException('Menu không thể là cha của chính nó');
      }
      await this.ensureParentExists(updateMenuDto.parentId);
    }

    const updated = await this.prisma.menu.update({
      where: { id },
      data: {
        menuKey: updateMenuDto.menuKey?.trim(),
        tenMenu: updateMenuDto.tenMenu?.trim(),
        routePath:
          updateMenuDto.routePath === undefined
            ? undefined
            : (updateMenuDto.routePath?.trim() || null),
        parentId: updateMenuDto.parentId,
        sortOrder: updateMenuDto.sortOrder,
        isActive: updateMenuDto.isActive,
      },
    });

    if (
      existing.parentId !== updated.parentId &&
      updated.parentId !== null &&
      (await this.isDescendant(updated.parentId, id))
    ) {
      throw new BadRequestException('Không thể gán menu cha là menu con của nó');
    }

    return updated;
  }

  async remove(id: number) {
    await this.findOne(id);

    const totalChildren = await this.prisma.menu.count({ where: { parentId: id } });
    if (totalChildren > 0) {
      throw new BadRequestException('Không thể xóa menu đang có menu con');
    }

    await this.prisma.menu.delete({ where: { id } });
    return { id };
  }

  async getRoleMenuIds(roleCode: string) {
    await this.ensureRoleExists(roleCode);

    const assigned = await this.prisma.roleMenuPermission.findMany({
      where: { roleCode },
      select: { menuId: true },
    });

    return {
      roleCode,
      menuIds: assigned.map((item) => item.menuId),
    };
  }

  async updateRoleMenus(roleCode: string, menuIds: number[]) {
    await this.ensureRoleExists(roleCode);

    const uniqueMenuIds = [...new Set((menuIds ?? []).filter((id) => Number.isInteger(id) && id > 0))];

    if (uniqueMenuIds.length > 0) {
      const totalExisting = await this.prisma.menu.count({
        where: { id: { in: uniqueMenuIds } },
      });
      if (totalExisting !== uniqueMenuIds.length) {
        throw new BadRequestException('Danh sách menu có phần tử không tồn tại');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.roleMenuPermission.deleteMany({ where: { roleCode } });

      if (uniqueMenuIds.length > 0) {
        await tx.roleMenuPermission.createMany({
          data: uniqueMenuIds.map((menuId) => ({ roleCode, menuId })),
          skipDuplicates: true,
        });
      }
    });

    return this.getRoleMenuIds(roleCode);
  }

  async getMenusByRole(roleCode: string) {
    await this.ensureRoleExists(roleCode);

    const roleMenus = await this.prisma.roleMenuPermission.findMany({
      where: { roleCode, menu: { isActive: true } },
      include: {
        menu: true,
      },
      orderBy: [{ menu: { sortOrder: 'asc' } }, { menu: { id: 'asc' } }],
    });

    const menus = roleMenus.map((item) => item.menu);
    return this.buildTree(menus);
  }

  private async findOne(id: number) {
    const menu = await this.prisma.menu.findUnique({ where: { id } });
    if (!menu) {
      throw new NotFoundException('Menu không tồn tại');
    }
    return menu;
  }

  private async ensureParentExists(id: number) {
    await this.findOne(id);
  }

  private async ensureRoleExists(code: string) {
    const role = await this.prisma.role.findUnique({ where: { code } });
    if (!role) {
      throw new NotFoundException('Quyền không tồn tại');
    }
  }

  private async isDescendant(parentId: number, currentId: number) {
    let cursor: number | null = parentId;

    while (cursor !== null) {
      if (cursor === currentId) {
        return true;
      }

      const parent = await this.prisma.menu.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }

    return false;
  }

  private buildTree(
    menus: Array<{
      id: number;
      menuKey: string;
      tenMenu: string;
      routePath: string | null;
      parentId: number | null;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    const byId = new Map<number, (typeof menus)[number] & { children: unknown[] }>();
    const roots: Array<(typeof menus)[number] & { children: unknown[] }> = [];

    for (const menu of menus) {
      byId.set(menu.id, { ...menu, children: [] });
    }

    for (const menu of byId.values()) {
      if (menu.parentId && byId.has(menu.parentId)) {
        byId.get(menu.parentId)!.children.push(menu);
      } else {
        roots.push(menu);
      }
    }

    return roots;
  }
}
