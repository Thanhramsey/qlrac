import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HouseholdsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    page = 1,
    limit = 20,
    serviceCatalogId?: number,
    tuyenThuRacId?: number,
    tenChuHo?: string,
    diaChi?: string,
  ) {
    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;
    const normalizedServiceCatalogId =
      Number.isInteger(serviceCatalogId) && (serviceCatalogId ?? 0) > 0
        ? serviceCatalogId
        : undefined;
    const normalizedRouteId =
      Number.isInteger(tuyenThuRacId) && (tuyenThuRacId ?? 0) > 0
        ? tuyenThuRacId
        : undefined;

    const where: Prisma.HouseholdWhereInput = {
      ...(normalizedServiceCatalogId
        ? { serviceCatalogId: normalizedServiceCatalogId }
        : {}),
      ...(normalizedRouteId
        ? { tuyenThuRacId: normalizedRouteId }
        : {}),
      ...(tenChuHo?.trim()
        ? {
            tenChuHo: {
              contains: tenChuHo.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
      ...(diaChi?.trim()
        ? {
            diaChi: {
              contains: diaChi.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.household.findMany({
        where,
        skip,
        take: normalizedLimit,
        orderBy: { id: 'desc' },
        include: {
          tuyenThuRac: {
            select: {
              id: true,
              maTuyen: true,
              tenTuyen: true,
            },
          },
          serviceCatalog: {
            select: {
              id: true,
              maDichVu: true,
              tenDichVu: true,
              giaDichVu: true,
              thuePhanTram: true,
            },
          },
        },
      }),
      this.prisma.household.count({ where }),
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
    const household = await this.prisma.household.findUnique({
      where: { id },
      include: {
        tuyenThuRac: {
          select: {
            id: true,
            maTuyen: true,
            tenTuyen: true,
          },
        },
        serviceCatalog: {
          select: {
            id: true,
            maDichVu: true,
            tenDichVu: true,
            giaDichVu: true,
            thuePhanTram: true,
          },
        },
      },
    });

    if (!household) {
      throw new NotFoundException(`Household with id ${id} not found`);
    }

    return this.toResponse(household);
  }

  async create(createHouseholdDto: CreateHouseholdDto) {
    this.validateCreatePayload(createHouseholdDto);

    const created = await this.prisma.household.create({
      data: {
        maHoDan: createHouseholdDto.maHoDan.trim(),
        tenChuHo: createHouseholdDto.tenChuHo.trim(),
        diaChi: createHouseholdDto.diaChi.trim(),
        soDienThoai: createHouseholdDto.soDienThoai.trim(),
        soGiayTo: createHouseholdDto.soGiayTo.trim(),
        ngayCapGiayTo: createHouseholdDto.ngayCapGiayTo
          ? new Date(createHouseholdDto.ngayCapGiayTo)
          : null,
        maSoThue: createHouseholdDto.maSoThue?.trim() || null,
        serviceCatalogId: createHouseholdDto.serviceCatalogId ?? null,
        tuyenThuRacId: createHouseholdDto.tuyenThuRacId,
        isActive: createHouseholdDto.isActive ?? true,
      },
      include: {
        tuyenThuRac: {
          select: {
            id: true,
            maTuyen: true,
            tenTuyen: true,
          },
        },
        serviceCatalog: {
          select: {
            id: true,
            maDichVu: true,
            tenDichVu: true,
            giaDichVu: true,
            thuePhanTram: true,
          },
        },
      },
    });

    return this.toResponse(created);
  }

  async update(id: number, updateHouseholdDto: UpdateHouseholdDto) {
    await this.findOne(id);

    const updated = await this.prisma.household.update({
      where: { id },
      data: {
        maHoDan: updateHouseholdDto.maHoDan?.trim(),
        tenChuHo: updateHouseholdDto.tenChuHo?.trim(),
        diaChi: updateHouseholdDto.diaChi?.trim(),
        soDienThoai: updateHouseholdDto.soDienThoai?.trim(),
        soGiayTo: updateHouseholdDto.soGiayTo?.trim(),
        ngayCapGiayTo:
          updateHouseholdDto.ngayCapGiayTo === undefined
            ? undefined
            : updateHouseholdDto.ngayCapGiayTo === null
              ? null
              : new Date(updateHouseholdDto.ngayCapGiayTo),
        maSoThue:
          updateHouseholdDto.maSoThue === undefined
            ? undefined
            : updateHouseholdDto.maSoThue?.trim() || null,
        serviceCatalogId: updateHouseholdDto.serviceCatalogId,
        tuyenThuRacId: updateHouseholdDto.tuyenThuRacId,
        isActive: updateHouseholdDto.isActive,
      },
      include: {
        tuyenThuRac: {
          select: {
            id: true,
            maTuyen: true,
            tenTuyen: true,
          },
        },
        serviceCatalog: {
          select: {
            id: true,
            maDichVu: true,
            tenDichVu: true,
            giaDichVu: true,
            thuePhanTram: true,
          },
        },
      },
    });

    return this.toResponse(updated);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.household.delete({ where: { id } });
    return { id };
  }

  async importFromExcel(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file import');
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      throw new BadRequestException('File import không có dữ liệu');
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[firstSheetName],
      {
        defval: '',
      },
    );

    let imported = 0;
    for (const rawRow of rows) {
      const maHoDan = String(rawRow.maHoDan ?? '').trim();
      const tenChuHo = String(rawRow.tenChuHo ?? '').trim();
      const diaChi = String(rawRow.diaChi ?? '').trim();
      const soDienThoai = String(rawRow.soDienThoai ?? '').trim();
      const soGiayTo = String(rawRow.soGiayTo ?? '').trim();
      const maSoThue = String(rawRow.maSoThue ?? '').trim();

      const tuyenThuRacId = Number(rawRow.tuyenThuRacId ?? NaN);
      const serviceCatalogIdRaw = String(rawRow.serviceCatalogId ?? '').trim();
      const serviceCatalogId = serviceCatalogIdRaw ? Number(serviceCatalogIdRaw) : null;
      const isActiveRaw = String(rawRow.isActive ?? '').trim().toLowerCase();
      const isActive = ['false', '0', 'khong', 'khóa', 'khoa'].includes(isActiveRaw)
        ? false
        : true;

      if (
        !maHoDan ||
        !tenChuHo ||
        !diaChi ||
        !soDienThoai ||
        !soGiayTo ||
        !Number.isInteger(tuyenThuRacId)
      ) {
        continue;
      }

      const ngayCapGiayToRaw = String(rawRow.ngayCapGiayTo ?? '').trim();
      const ngayCapGiayTo = ngayCapGiayToRaw ? new Date(ngayCapGiayToRaw) : null;

      await this.prisma.household.upsert({
        where: { maHoDan },
        update: {
          tenChuHo,
          diaChi,
          soDienThoai,
          soGiayTo,
          ngayCapGiayTo,
          maSoThue: maSoThue || null,
          serviceCatalogId: Number.isInteger(serviceCatalogId) ? serviceCatalogId : null,
          tuyenThuRacId,
          isActive,
        },
        create: {
          maHoDan,
          tenChuHo,
          diaChi,
          soDienThoai,
          soGiayTo,
          ngayCapGiayTo,
          maSoThue: maSoThue || null,
          serviceCatalogId: Number.isInteger(serviceCatalogId) ? serviceCatalogId : null,
          tuyenThuRacId,
          isActive,
        },
      });

      imported += 1;
    }

    return {
      message: `Import hộ dân thành công: ${imported} bản ghi`,
      imported,
    };
  }

  private validateCreatePayload(payload: CreateHouseholdDto) {
    if (!payload.maHoDan?.trim()) {
      throw new BadRequestException('Mã hộ dân là bắt buộc');
    }

    if (!payload.tenChuHo?.trim()) {
      throw new BadRequestException('Họ tên chủ hộ là bắt buộc');
    }

    if (!payload.diaChi?.trim()) {
      throw new BadRequestException('Địa chỉ là bắt buộc');
    }

    if (!payload.soDienThoai?.trim()) {
      throw new BadRequestException('Số điện thoại là bắt buộc');
    }

    if (!payload.soGiayTo?.trim()) {
      throw new BadRequestException('Số giấy tờ là bắt buộc');
    }

    if (!Number.isInteger(payload.tuyenThuRacId) || payload.tuyenThuRacId <= 0) {
      throw new BadRequestException('Tuyến đường không hợp lệ');
    }
  }

  private toResponse(item: {
    id: number;
    maHoDan: string;
    tenChuHo: string;
    diaChi: string;
    soDienThoai: string;
    soGiayTo: string;
    ngayCapGiayTo: Date | null;
    maSoThue: string | null;
    serviceCatalogId: number | null;
    tuyenThuRacId: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    tuyenThuRac?: {
      id: number;
      maTuyen: string;
      tenTuyen: string;
    };
    serviceCatalog?: {
      id: number;
      maDichVu: string;
      tenDichVu: string;
      giaDichVu: unknown;
      thuePhanTram: unknown;
    } | null;
  }) {
    return {
      ...item,
      serviceCatalog: item.serviceCatalog
        ? {
            ...item.serviceCatalog,
            giaDichVu: Number(item.serviceCatalog.giaDichVu),
            thuePhanTram: Number(item.serviceCatalog.thuePhanTram),
          }
        : null,
    };
  }
}