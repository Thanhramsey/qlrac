import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.collection.findMany({
        where: { isActive: true },
        skip,
        take: normalizedLimit,
        orderBy: { id: 'desc' },
      }),
      this.prisma.collection.count({ where: { isActive: true } }),
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
    const collection = await this.prisma.collection.findFirst({
      where: { id, isActive: true },
    });

    if (!collection) {
      throw new NotFoundException(`Collection with id ${id} not found`);
    }

    return collection;
  }

  create(createCollectionDto: CreateCollectionDto) {
    return this.prisma.collection.create({
      data: {
        ...createCollectionDto,
        ngayThuGom: new Date(createCollectionDto.ngayThuGom),
      },
    });
  }

  async update(id: number, updateCollectionDto: UpdateCollectionDto) {
    await this.findOne(id);

    return this.prisma.collection.update({
      where: { id },
      data: {
        ...updateCollectionDto,
        ngayThuGom: updateCollectionDto.ngayThuGom
          ? new Date(updateCollectionDto.ngayThuGom)
          : undefined,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.collection.update({
      where: { id },
      data: { isActive: false },
    });
    return { id };
  }

  async restore(id: number) {
    const collection = await this.prisma.collection.findUnique({ where: { id } });
    if (!collection) {
      throw new NotFoundException(`Collection with id ${id} not found`);
    }

    await this.prisma.collection.update({
      where: { id },
      data: { isActive: true },
    });

    return { id };
  }
}