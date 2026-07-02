import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HouseholdsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.household.findMany({
        skip,
        take: normalizedLimit,
        orderBy: { id: 'desc' },
      }),
      this.prisma.household.count(),
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
    const household = await this.prisma.household.findUnique({
      where: { id },
    });

    if (!household) {
      throw new NotFoundException(`Household with id ${id} not found`);
    }

    return household;
  }

  create(createHouseholdDto: CreateHouseholdDto) {
    return this.prisma.household.create({
      data: createHouseholdDto,
    });
  }

  async update(id: number, updateHouseholdDto: UpdateHouseholdDto) {
    await this.findOne(id);

    return this.prisma.household.update({
      where: { id },
      data: updateHouseholdDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.household.delete({ where: { id } });
    return { id };
  }
}