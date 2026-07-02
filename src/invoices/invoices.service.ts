import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        skip,
        take: normalizedLimit,
        orderBy: { id: 'desc' },
      }),
      this.prisma.invoice.count(),
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
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with id ${id} not found`);
    }

    return invoice;
  }

  create(createInvoiceDto: CreateInvoiceDto) {
    return this.prisma.invoice.create({
      data: {
        ...createInvoiceDto,
        tongTien: createInvoiceDto.tongTien,
        thue: createInvoiceDto.thue,
        hanThanhToan: new Date(createInvoiceDto.hanThanhToan),
      },
    });
  }

  async update(id: number, updateInvoiceDto: UpdateInvoiceDto) {
    await this.findOne(id);

    return this.prisma.invoice.update({
      where: { id },
      data: {
        ...updateInvoiceDto,
        tongTien: updateInvoiceDto.tongTien,
        thue: updateInvoiceDto.thue,
        hanThanhToan: updateInvoiceDto.hanThanhToan
          ? new Date(updateInvoiceDto.hanThanhToan)
          : undefined,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.invoice.delete({ where: { id } });
    return { id };
  }
}