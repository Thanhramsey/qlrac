import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ServiceCatalog } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceCatalogDto } from './dto/create-service-catalog.dto';
import { UpdateServiceCatalogDto } from './dto/update-service-catalog.dto';

@Injectable()
export class ServiceCatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.serviceCatalog.findMany({
        skip,
        take: normalizedLimit,
        orderBy: { id: 'desc' },
      }),
      this.prisma.serviceCatalog.count(),
    ]);

    return {
      data: data.map((item) => this.toResponse(item)),
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        totalPages: Math.ceil(total / normalizedLimit),
      },
    };
  }

  async findOne(id: number) {
    const service = await this.prisma.serviceCatalog.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException(`Service catalog with id ${id} not found`);
    }

    return this.toResponse(service);
  }

  async create(createServiceCatalogDto: CreateServiceCatalogDto) {
    this.validateMoney(createServiceCatalogDto.giaDichVu, 'Giá dịch vụ');
    this.validateMoney(createServiceCatalogDto.thuePhanTram, 'Thuế phần trăm');

    const service = await this.prisma.serviceCatalog.create({
      data: {
        maDichVu: createServiceCatalogDto.maDichVu.trim(),
        tenDichVu: createServiceCatalogDto.tenDichVu.trim(),
        giaDichVu: createServiceCatalogDto.giaDichVu,
        thuePhanTram: createServiceCatalogDto.thuePhanTram,
        isActive: createServiceCatalogDto.isActive ?? true,
        ghiChu: createServiceCatalogDto.ghiChu?.trim(),
      },
    });

    return this.toResponse(service);
  }

  async update(id: number, updateServiceCatalogDto: UpdateServiceCatalogDto) {
    await this.findOne(id);

    if (updateServiceCatalogDto.giaDichVu !== undefined) {
      this.validateMoney(updateServiceCatalogDto.giaDichVu, 'Giá dịch vụ');
    }

    if (updateServiceCatalogDto.thuePhanTram !== undefined) {
      this.validateMoney(updateServiceCatalogDto.thuePhanTram, 'Thuế phần trăm');
    }

    const service = await this.prisma.serviceCatalog.update({
      where: { id },
      data: {
        maDichVu: updateServiceCatalogDto.maDichVu?.trim(),
        tenDichVu: updateServiceCatalogDto.tenDichVu?.trim(),
        giaDichVu: updateServiceCatalogDto.giaDichVu,
        thuePhanTram: updateServiceCatalogDto.thuePhanTram,
        isActive: updateServiceCatalogDto.isActive,
        ghiChu: updateServiceCatalogDto.ghiChu?.trim(),
      },
    });

    return this.toResponse(service);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.serviceCatalog.delete({ where: { id } });
    return { id };
  }

  private validateMoney(value: number, fieldName: string) {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${fieldName} không hợp lệ`);
    }
  }

  private toResponse(item: ServiceCatalog) {
    return {
      id: item.id,
      maDichVu: item.maDichVu,
      tenDichVu: item.tenDichVu,
      giaDichVu: Number(item.giaDichVu),
      thuePhanTram: Number(item.thuePhanTram),
      isActive: item.isActive,
      ghiChu: item.ghiChu,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
