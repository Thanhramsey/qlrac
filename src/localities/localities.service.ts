import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocalityDto } from './dto/create-locality.dto';
import { UpdateLocalityDto } from './dto/update-locality.dto';

@Injectable()
export class LocalitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20, wardId?: number) {
    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const where = Number.isFinite(wardId) ? { wardId: Number(wardId) } : undefined;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.locality.findMany({
        where,
        skip,
        take: normalizedLimit,
        orderBy: { id: 'desc' },
        include: {
          ward: {
            select: {
              id: true,
              maPhuongXa: true,
              tenPhuongXa: true,
              province: {
                select: {
                  id: true,
                  maTinh: true,
                  tenTinh: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.locality.count({ where }),
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
    const locality = await this.prisma.locality.findUnique({
      where: { id },
      include: {
        ward: {
          select: {
            id: true,
            maPhuongXa: true,
            tenPhuongXa: true,
            province: {
              select: {
                id: true,
                maTinh: true,
                tenTinh: true,
              },
            },
          },
        },
      },
    });

    if (!locality) {
      throw new NotFoundException(`Locality with id ${id} not found`);
    }

    return locality;
  }

  async create(createLocalityDto: CreateLocalityDto) {
    await this.ensureWardExists(createLocalityDto.wardId);

    return this.prisma.locality.create({
      data: {
        wardId: createLocalityDto.wardId,
        maThonXomTo: createLocalityDto.maThonXomTo,
        tenThonXomTo: createLocalityDto.tenThonXomTo,
      },
      include: {
        ward: {
          select: {
            id: true,
            maPhuongXa: true,
            tenPhuongXa: true,
            province: {
              select: {
                id: true,
                maTinh: true,
                tenTinh: true,
              },
            },
          },
        },
      },
    });
  }

  async update(id: number, updateLocalityDto: UpdateLocalityDto) {
    await this.findOne(id);

    if (updateLocalityDto.wardId) {
      await this.ensureWardExists(updateLocalityDto.wardId);
    }

    return this.prisma.locality.update({
      where: { id },
      data: {
        wardId: updateLocalityDto.wardId,
        maThonXomTo: updateLocalityDto.maThonXomTo,
        tenThonXomTo: updateLocalityDto.tenThonXomTo,
      },
      include: {
        ward: {
          select: {
            id: true,
            maPhuongXa: true,
            tenPhuongXa: true,
            province: {
              select: {
                id: true,
                maTinh: true,
                tenTinh: true,
              },
            },
          },
        },
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.locality.delete({ where: { id } });
    return { id };
  }

  private async ensureWardExists(wardId: number) {
    const ward = await this.prisma.ward.findUnique({
      where: { id: wardId },
      select: { id: true },
    });

    if (!ward) {
      throw new BadRequestException('Phường/Xã không tồn tại');
    }
  }
}
