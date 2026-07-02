import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(code: string) {
    const role = await this.prisma.role.findUnique({ where: { code } });
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

    await this.prisma.role.delete({ where: { code } });
    return { code };
  }

  getUserPermissionPlaceholder() {
    return {
      message:
        'Tính năng phân quyền người dùng sẽ phát triển ở giai đoạn tiếp theo',
    };
  }
}
