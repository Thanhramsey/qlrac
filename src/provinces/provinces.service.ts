import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProvinceDto } from './dto/create-province.dto';
import { UpdateProvinceDto } from './dto/update-province.dto';

@Injectable()
export class ProvincesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.province.findMany({
        where: { isActive: true },
        skip,
        take: normalizedLimit,
        orderBy: { id: 'desc' },
      }),
      this.prisma.province.count({ where: { isActive: true } }),
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
    const province = await this.prisma.province.findFirst({ where: { id, isActive: true } });
    if (!province) {
      throw new NotFoundException(`Province with id ${id} not found`);
    }

    return province;
  }

  create(createProvinceDto: CreateProvinceDto) {
    return this.prisma.province.create({ data: createProvinceDto });
  }

  async update(id: number, updateProvinceDto: UpdateProvinceDto) {
    await this.findOne(id);

    return this.prisma.province.update({
      where: { id },
      data: updateProvinceDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.province.update({
      where: { id },
      data: { isActive: false },
    });
    return { id };
  }

  async restore(id: number) {
    const province = await this.prisma.province.findUnique({ where: { id } });
    if (!province) {
      throw new NotFoundException(`Province with id ${id} not found`);
    }

    await this.prisma.province.update({
      where: { id },
      data: { isActive: true },
    });

    return { id };
  }
}
