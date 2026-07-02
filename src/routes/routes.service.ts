import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.route.findMany({
        skip,
        take: normalizedLimit,
        orderBy: { id: 'desc' },
      }),
      this.prisma.route.count(),
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
    const route = await this.prisma.route.findUnique({
      where: { id },
    });

    if (!route) {
      throw new NotFoundException(`Route with id ${id} not found`);
    }

    return route;
  }

  create(createRouteDto: CreateRouteDto) {
    return this.prisma.route.create({
      data: createRouteDto,
    });
  }

  async update(id: number, updateRouteDto: UpdateRouteDto) {
    await this.findOne(id);

    return this.prisma.route.update({
      where: { id },
      data: updateRouteDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.route.delete({ where: { id } });
    return { id };
  }
}