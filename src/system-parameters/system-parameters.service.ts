import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSystemParameterDto } from './dto/create-system-parameter.dto';
import { UpdateSystemParameterDto } from './dto/update-system-parameter.dto';

@Injectable()
export class SystemParametersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20, keyword?: string, includeInactive = false) {
    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const where = keyword?.trim()
      ? {
          ...(includeInactive ? {} : { isActive: true }),
          tenThamSo: {
            contains: keyword.trim(),
            mode: 'insensitive' as const,
          },
        }
      : includeInactive
        ? undefined
        : { isActive: true };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.systemParameter.findMany({
        where,
        skip,
        take: normalizedLimit,
        orderBy: { id: 'asc' },
      }),
      this.prisma.systemParameter.count({ where }),
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
    const item = await this.prisma.systemParameter.findFirst({ where: { id, isActive: true } });
    if (!item) {
      throw new NotFoundException('Tham số hệ thống không tồn tại');
    }

    return item;
  }

  async create(dto: CreateSystemParameterDto) {
    const tenThamSo = dto.tenThamSo?.trim();
    if (!tenThamSo) {
      throw new BadRequestException('Tên tham số là bắt buộc');
    }

    return this.prisma.systemParameter.create({
      data: {
        tenThamSo,
        giaTri: dto.giaTri ?? '',
      },
    });
  }

  async update(id: number, dto: UpdateSystemParameterDto) {
    await this.findOne(id);

    const tenThamSo = dto.tenThamSo?.trim();
    if (dto.tenThamSo !== undefined && !tenThamSo) {
      throw new BadRequestException('Tên tham số không được để trống');
    }

    return this.prisma.systemParameter.update({
      where: { id },
      data: {
        tenThamSo,
        giaTri: dto.giaTri,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.systemParameter.update({
      where: { id },
      data: { isActive: false },
    });
    return { id };
  }

  async restore(id: number) {
    const item = await this.prisma.systemParameter.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('Tham số hệ thống không tồn tại');
    }

    await this.prisma.systemParameter.update({
      where: { id },
      data: { isActive: true },
    });

    return { id };
  }
}
