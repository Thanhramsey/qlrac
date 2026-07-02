import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20, localityId?: number, staffId?: number) {
    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const where = {
      ...(Number.isFinite(localityId)
        ? { localityId: Number(localityId) }
        : {}),
      ...(Number.isFinite(staffId) ? { staffId: Number(staffId) } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.route.findMany({
        where,
        skip,
        take: normalizedLimit,
        orderBy: { id: 'desc' },
        include: {
          locality: {
            select: {
              id: true,
              maThonXomTo: true,
              tenThonXomTo: true,
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
          },
          staff: {
            select: {
              id: true,
              taiKhoan: true,
              hoVaTen: true,
              roleCode: true,
              isActive: true,
            },
          },
        },
      }),
      this.prisma.route.count({ where }),
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
      include: {
        locality: {
          select: {
            id: true,
            maThonXomTo: true,
            tenThonXomTo: true,
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
        },
        staff: {
          select: {
            id: true,
            taiKhoan: true,
            hoVaTen: true,
            roleCode: true,
            isActive: true,
          },
        },
      },
    });

    if (!route) {
      throw new NotFoundException(`Route with id ${id} not found`);
    }

    return route;
  }

  async create(createRouteDto: CreateRouteDto) {
    if (createRouteDto.localityId) {
      await this.ensureLocalityExists(createRouteDto.localityId);
    }

    if (createRouteDto.staffId) {
      await this.ensureStaffExists(createRouteDto.staffId);
    }

    return this.prisma.route.create({
      data: createRouteDto,
      include: {
        locality: {
          select: {
            id: true,
            maThonXomTo: true,
            tenThonXomTo: true,
          },
        },
        staff: {
          select: {
            id: true,
            taiKhoan: true,
            hoVaTen: true,
            roleCode: true,
          },
        },
      },
    });
  }

  async update(id: number, updateRouteDto: UpdateRouteDto) {
    await this.findOne(id);

    if (updateRouteDto.localityId) {
      await this.ensureLocalityExists(updateRouteDto.localityId);
    }

    if (
      updateRouteDto.staffId !== null &&
      updateRouteDto.staffId !== undefined &&
      Number.isFinite(updateRouteDto.staffId)
    ) {
      await this.ensureStaffExists(updateRouteDto.staffId);
    }

    return this.prisma.route.update({
      where: { id },
      data: updateRouteDto,
      include: {
        locality: {
          select: {
            id: true,
            maThonXomTo: true,
            tenThonXomTo: true,
          },
        },
        staff: {
          select: {
            id: true,
            taiKhoan: true,
            hoVaTen: true,
            roleCode: true,
          },
        },
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.route.delete({ where: { id } });
    return { id };
  }

  async importFromExcel(file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Vui lòng tải lên file Excel hợp lệ');
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('File Excel không có dữ liệu');
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });

    if (!rows.length) {
      throw new BadRequestException('File Excel không có dòng dữ liệu');
    }

    const normalizedRows = rows.map((row) => ({
      maTuyen: this.toText(row.maTuyen),
      tenTuyen: this.toText(row.tenTuyen),
      khuVuc: this.toText(row.khuVuc),
      localityId: this.toOptionalNumber(row.localityId),
      staffId: this.toOptionalNumber(row.staffId),
    }));

    for (let index = 0; index < normalizedRows.length; index++) {
      const row = normalizedRows[index];
      if (!row.maTuyen || !row.tenTuyen || !row.khuVuc) {
        throw new BadRequestException(
          `Dòng ${index + 2}: cần có maTuyen, tenTuyen, khuVuc`,
        );
      }

      if (row.localityId !== undefined) {
        await this.ensureLocalityExists(row.localityId);
      }

      if (row.staffId !== undefined) {
        await this.ensureStaffExists(row.staffId);
      }
    }

    const results = await this.prisma.$transaction(
      normalizedRows.map((row) =>
        this.prisma.route.upsert({
          where: { maTuyen: row.maTuyen },
          update: {
            tenTuyen: row.tenTuyen,
            khuVuc: row.khuVuc,
            localityId: row.localityId ?? null,
            staffId: row.staffId ?? null,
          },
          create: {
            maTuyen: row.maTuyen,
            tenTuyen: row.tenTuyen,
            khuVuc: row.khuVuc,
            localityId: row.localityId,
            staffId: row.staffId,
          },
        }),
      ),
    );

    return {
      message: 'Import tuyến đường thành công',
      totalRows: normalizedRows.length,
      affectedRows: results.length,
      guide: {
        requiredColumns: ['maTuyen', 'tenTuyen', 'khuVuc'],
        optionalColumns: ['localityId', 'staffId'],
      },
    };
  }

  private async ensureLocalityExists(localityId: number) {
    const locality = await this.prisma.locality.findUnique({
      where: { id: localityId },
      select: { id: true },
    });

    if (!locality) {
      throw new BadRequestException('Thôn/Xóm/Tổ không tồn tại');
    }
  }

  private async ensureStaffExists(staffId: number) {
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
      select: { id: true, isActive: true },
    });

    if (!staff || !staff.isActive) {
      throw new BadRequestException('Nhân viên phụ trách không hợp lệ');
    }
  }

  private toText(value: unknown) {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  }

  private toOptionalNumber(value: unknown) {
    const normalized = this.toText(value);
    if (!normalized) {
      return undefined;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException(`Giá trị số không hợp lệ: ${normalized}`);
    }

    return parsed;
  }
}