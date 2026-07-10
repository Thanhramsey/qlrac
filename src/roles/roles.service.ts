import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { APP_PERMISSIONS } from '../auth/constants/app-permissions.constant';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.role.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(code: string) {
    const role = await this.prisma.role.findFirst({ where: { code, isActive: true } });
    if (!role) {
      throw new NotFoundException('Quyền không tồn tại');
    }

    return role;
  }

  async create(createRoleDto: CreateRoleDto) {
    if (!createRoleDto.code?.trim()) {
      throw new BadRequestException('Trường mã quyền là bắt buộc');
    }

    if (!createRoleDto.label?.trim()) {
      throw new BadRequestException('Trường tên quyền là bắt buộc');
    }

    return this.prisma.role.create({
      data: {
        code: createRoleDto.code.trim(),
        label: createRoleDto.label.trim(),
        moTa: createRoleDto.moTa?.trim(),
        isActive: createRoleDto.isActive ?? true,
      },
    });
  }

  async update(code: string, updateRoleDto: UpdateRoleDto) {
    await this.findOne(code);

    return this.prisma.role.update({
      where: { code },
      data: {
        label: updateRoleDto.label?.trim(),
        moTa: updateRoleDto.moTa?.trim(),
        isActive: updateRoleDto.isActive,
      },
    });
  }

  async remove(code: string) {
    await this.findOne(code);

    const totalUsers = await this.prisma.user.count({
      where: { roleCode: code },
    });

    if (totalUsers > 0) {
      throw new BadRequestException(
        'Không thể xóa quyền vì vẫn còn người dùng đang sử dụng quyền này',
      );
    }

    await this.prisma.role.update({
      where: { code },
      data: { isActive: false },
    });
    return { code };
  }

  async restore(code: string) {
    const role = await this.prisma.role.findUnique({ where: { code } });
    if (!role) {
      throw new NotFoundException('Quyền không tồn tại');
    }

    await this.prisma.role.update({
      where: { code },
      data: { isActive: true },
    });

    return { code };
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      where: { isActive: true },
      orderBy: [{ moduleKey: 'asc' }, { code: 'asc' }],
    });
  }

  async getRolePermissions(code: string) {
    await this.findOne(code);

    const assigned = await this.prisma.rolePermission.findMany({
      where: { roleCode: code, permission: { isActive: true } },
      select: { permissionCode: true },
      orderBy: { permissionCode: 'asc' },
    });

    return {
      roleCode: code,
      permissionCodes: assigned.map((item) => item.permissionCode),
    };
  }

  async updateRolePermissions(
    code: string,
    permissionCodes: string[],
    actor?: JwtPayload,
  ) {
    await this.findOne(code);

    const uniquePermissionCodes = [
      ...new Set((permissionCodes ?? []).map((item) => item?.trim()).filter(Boolean)),
    ];

    if (uniquePermissionCodes.length > 0) {
      const existing = await this.prisma.permission.findMany({
        where: {
          code: { in: uniquePermissionCodes },
          isActive: true,
        },
        select: { code: true },
      });

      const existingSet = new Set(existing.map((item) => item.code));
      const invalidCodes = uniquePermissionCodes.filter((codeValue) => !existingSet.has(codeValue));
      if (invalidCodes.length > 0) {
        throw new BadRequestException(
          `Danh sách quyền không hợp lệ: ${invalidCodes.join(', ')}`,
        );
      }
    }

    const containsDangerousPermissions = uniquePermissionCodes.some(
      (permissionCode) =>
        permissionCode.endsWith('.delete') || permissionCode.endsWith('.restore'),
    );

    if (containsDangerousPermissions) {
      if (!actor?.role) {
        throw new ForbiddenException('Không thể xác định người thao tác');
      }

      const dangerousGrantPermission = await this.prisma.rolePermission.findFirst({
        where: {
          roleCode: actor.role,
          permissionCode: APP_PERMISSIONS.ROLES_PERMISSION_MANAGE_DANGEROUS,
          permission: { isActive: true },
        },
        select: { permissionCode: true },
      });

      if (!dangerousGrantPermission) {
        throw new ForbiddenException(
          'Bạn không có quyền gán các permission nhạy cảm (.delete/.restore)',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleCode: code } });

      if (uniquePermissionCodes.length > 0) {
        await tx.rolePermission.createMany({
          data: uniquePermissionCodes.map((permissionCode) => ({
            roleCode: code,
            permissionCode,
          })),
          skipDuplicates: true,
        });
      }
    });

    return this.getRolePermissions(code);
  }

  getUserPermissionPlaceholder() {
    return {
      message:
        'Dùng API /roles/permissions và /roles/:code/permissions để quản lý quyền API theo role',
      availablePermissionCodes: Object.values(APP_PERMISSIONS),
    };
  }
}
