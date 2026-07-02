import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip,
        take: normalizedLimit,
        orderBy: { id: 'desc' },
        select: {
          id: true,
          taiKhoan: true,
          hoVaTen: true,
          ngaySinh: true,
          gioiTinh: true,
          soDienThoai: true,
          soGiayTo: true,
          diaChi: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data,
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        totalPages: Math.ceil(total / normalizedLimit),
      },
    };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        taiKhoan: true,
        hoVaTen: true,
        ngaySinh: true,
        gioiTinh: true,
        soDienThoai: true,
        soGiayTo: true,
        diaChi: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  async create(createUserDto: CreateUserDto) {
    this.validateRequiredFields(createUserDto);

    const matKhauHash = await hash(createUserDto.matKhau, 10);

    return this.prisma.user.create({
      data: {
        taiKhoan: createUserDto.taiKhoan.trim(),
        matKhauHash,
        hoVaTen: createUserDto.hoVaTen.trim(),
        ngaySinh: createUserDto.ngaySinh
          ? new Date(createUserDto.ngaySinh)
          : undefined,
        gioiTinh: createUserDto.gioiTinh?.trim(),
        soDienThoai: createUserDto.soDienThoai.trim(),
        soGiayTo: createUserDto.soGiayTo.trim(),
        diaChi: createUserDto.diaChi?.trim(),
        email: createUserDto.email?.trim(),
        role: createUserDto.role ?? 'STAFF',
      },
      select: {
        id: true,
        taiKhoan: true,
        hoVaTen: true,
        ngaySinh: true,
        gioiTinh: true,
        soDienThoai: true,
        soGiayTo: true,
        diaChi: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.findOne(id);

    const matKhauHash = updateUserDto.matKhau
      ? await hash(updateUserDto.matKhau, 10)
      : undefined;

    return this.prisma.user.update({
      where: { id },
      data: {
        taiKhoan: updateUserDto.taiKhoan?.trim(),
        matKhauHash,
        hoVaTen: updateUserDto.hoVaTen?.trim(),
        ngaySinh: updateUserDto.ngaySinh
          ? new Date(updateUserDto.ngaySinh)
          : undefined,
        gioiTinh: updateUserDto.gioiTinh?.trim(),
        soDienThoai: updateUserDto.soDienThoai?.trim(),
        soGiayTo: updateUserDto.soGiayTo?.trim(),
        diaChi: updateUserDto.diaChi?.trim(),
        email: updateUserDto.email?.trim(),
        role: updateUserDto.role,
        isActive: updateUserDto.isActive,
      },
      select: {
        id: true,
        taiKhoan: true,
        hoVaTen: true,
        ngaySinh: true,
        gioiTinh: true,
        soDienThoai: true,
        soGiayTo: true,
        diaChi: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { id };
  }

  private validateRequiredFields(data: CreateUserDto) {
    if (!data.taiKhoan?.trim()) {
      throw new BadRequestException('Trường tài khoản là bắt buộc');
    }

    if (!data.matKhau?.trim()) {
      throw new BadRequestException('Trường mật khẩu là bắt buộc');
    }

    if (!data.hoVaTen?.trim()) {
      throw new BadRequestException('Trường họ và tên là bắt buộc');
    }

    if (!data.soDienThoai?.trim()) {
      throw new BadRequestException('Trường số điện thoại là bắt buộc');
    }

    if (!data.soGiayTo?.trim()) {
      throw new BadRequestException('Trường số giấy tờ là bắt buộc');
    }
  }
}
