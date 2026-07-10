import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWardDto } from './dto/create-ward.dto';
import { UpdateWardDto } from './dto/update-ward.dto';

@Injectable()
export class WardsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20, provinceId?: number) {
    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const where = Number.isFinite(provinceId)
      ? { provinceId: Number(provinceId), isActive: true }
      : { isActive: true };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.ward.findMany({
        where,
        skip,
        take: normalizedLimit,
        orderBy: { id: 'desc' },
        include: {
          province: {
            select: {
              id: true,
              maTinh: true,
              tenTinh: true,
            },
          },
        },
      }),
      this.prisma.ward.count({ where }),
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
    const ward = await this.prisma.ward.findFirst({
      where: { id, isActive: true },
      include: {
        province: {
          select: {
            id: true,
            maTinh: true,
            tenTinh: true,
          },
        },
      },
    });

    if (!ward) {
      throw new NotFoundException(`Ward with id ${id} not found`);
    }

    return ward;
  }

  async create(createWardDto: CreateWardDto) {
    await this.ensureProvinceExists(createWardDto.provinceId);

    return this.prisma.ward.create({
      data: {
        provinceId: createWardDto.provinceId,
        maPhuongXa: createWardDto.maPhuongXa,
        tenPhuongXa: createWardDto.tenPhuongXa,
      },
      include: {
        province: {
          select: {
            id: true,
            maTinh: true,
            tenTinh: true,
          },
        },
      },
    });
  }

  async update(id: number, updateWardDto: UpdateWardDto) {
    await this.findOne(id);

    if (updateWardDto.provinceId) {
      await this.ensureProvinceExists(updateWardDto.provinceId);
    }

    return this.prisma.ward.update({
      where: { id },
      data: {
        provinceId: updateWardDto.provinceId,
        maPhuongXa: updateWardDto.maPhuongXa,
        tenPhuongXa: updateWardDto.tenPhuongXa,
      },
      include: {
        province: {
          select: {
            id: true,
            maTinh: true,
            tenTinh: true,
          },
        },
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.ward.update({
      where: { id },
      data: { isActive: false },
    });
    return { id };
  }

  async restore(id: number) {
    const ward = await this.prisma.ward.findUnique({ where: { id } });
    if (!ward) {
      throw new NotFoundException(`Ward with id ${id} not found`);
    }

    await this.prisma.ward.update({
      where: { id },
      data: { isActive: true },
    });

    return { id };
  }

  private async ensureProvinceExists(provinceId: number) {
    const province = await this.prisma.province.findFirst({
      where: { id: provinceId, isActive: true },
      select: { id: true },
    });

    if (!province) {
      throw new BadRequestException('Tỉnh không tồn tại');
    }
  }
}
