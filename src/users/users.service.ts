import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip,
        take: normalizedLimit,
        orderBy: { id: 'desc' },
        select: this.userSelect,
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: data.map((item) => this.toUserResponse(item)),
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        totalPages: Math.ceil(total / normalizedLimit),
      },
    };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.userSelect,
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return this.toUserResponse(user);
  }

  async create(createUserDto: CreateUserDto) {
    this.validateRequiredFields(createUserDto);
    const roleCode = createUserDto.role?.trim() || 'STAFF';
    await this.ensureRoleExists(roleCode);
    const routeIds = this.normalizeRouteIds(createUserDto.routeIds);
    await this.ensureRoutesExist(routeIds);

    const matKhauHash = await hash(createUserDto.matKhau, 10);

    const user = await this.prisma.user.create({
      data: {
        taiKhoan: createUserDto.taiKhoan.trim(),
        matKhauHash,
        hoVaTen: createUserDto.hoVaTen.trim(),
        ngaySinh: createUserDto.ngaySinh
          ? new Date(createUserDto.ngaySinh)
          : undefined,
        gioiTinh: createUserDto.gioiTinh?.trim(),
        soDienThoai: createUserDto.soDienThoai.trim(),
        soGiayTo: createUserDto.soGiayTo.trim(),
        diaChi: createUserDto.diaChi?.trim(),
        email: createUserDto.email?.trim(),
        roleCode,
        assignedRoutes: routeIds.length
          ? {
              connect: routeIds.map((id) => ({ id })),
            }
          : undefined,
      },
      select: this.userSelect,
    });

    return this.toUserResponse(user);
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.findOne(id);

    const roleCode = updateUserDto.role?.trim();
    if (roleCode) {
      await this.ensureRoleExists(roleCode);
    }

    const matKhauHash = updateUserDto.matKhau
      ? await hash(updateUserDto.matKhau, 10)
      : undefined;

    const routeIds = this.normalizeRouteIds(updateUserDto.routeIds);
    if (updateUserDto.routeIds !== undefined) {
      await this.ensureRoutesExist(routeIds);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        taiKhoan: updateUserDto.taiKhoan?.trim(),
        matKhauHash,
        hoVaTen: updateUserDto.hoVaTen?.trim(),
        ngaySinh: updateUserDto.ngaySinh
          ? new Date(updateUserDto.ngaySinh)
          : undefined,
        gioiTinh: updateUserDto.gioiTinh?.trim(),
        soDienThoai: updateUserDto.soDienThoai?.trim(),
        soGiayTo: updateUserDto.soGiayTo?.trim(),
        diaChi: updateUserDto.diaChi?.trim(),
        email: updateUserDto.email?.trim(),
        roleCode,
        isActive: updateUserDto.isActive,
        assignedRoutes:
          updateUserDto.routeIds !== undefined
            ? {
                set: routeIds.map((routeId) => ({ id: routeId })),
              }
            : undefined,
      },
      select: this.userSelect,
    });

    return this.toUserResponse(user);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
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
      taiKhoan: this.toText(row.taiKhoan),
      matKhau: this.toText(row.matKhau),
      hoVaTen: this.toText(row.hoVaTen),
      ngaySinh: this.toOptionalText(row.ngaySinh),
      gioiTinh: this.toOptionalText(row.gioiTinh),
      soDienThoai: this.toText(row.soDienThoai),
      soGiayTo: this.toText(row.soGiayTo),
      diaChi: this.toOptionalText(row.diaChi),
      email: this.toOptionalText(row.email),
      role: this.toOptionalText(row.role) ?? 'STAFF',
      routeIds: this.toOptionalNumberArray(row.routeIds),
      isActive: this.toOptionalBoolean(row.isActive),
    }));

    for (let index = 0; index < normalizedRows.length; index++) {
      const row = normalizedRows[index];
      if (
        !row.taiKhoan ||
        !row.matKhau ||
        !row.hoVaTen ||
        !row.soDienThoai ||
        !row.soGiayTo
      ) {
        throw new BadRequestException(
          `Dòng ${index + 2}: cần có taiKhoan, matKhau, hoVaTen, soDienThoai, soGiayTo`,
        );
      }

      await this.ensureRoleExists(row.role);
      await this.ensureRoutesExist(row.routeIds);
    }

    for (const row of normalizedRows) {
      const matKhauHash = await hash(row.matKhau, 10);

      await this.prisma.user.upsert({
        where: { taiKhoan: row.taiKhoan },
        update: {
          matKhauHash,
          hoVaTen: row.hoVaTen,
          ngaySinh: row.ngaySinh ? new Date(row.ngaySinh) : null,
          gioiTinh: row.gioiTinh ?? null,
          soDienThoai: row.soDienThoai,
          soGiayTo: row.soGiayTo,
          diaChi: row.diaChi ?? null,
          email: row.email ?? null,
          roleCode: row.role,
          isActive: row.isActive ?? true,
          assignedRoutes: {
            set: row.routeIds.map((routeId) => ({ id: routeId })),
          },
        },
        create: {
          taiKhoan: row.taiKhoan,
          matKhauHash,
          hoVaTen: row.hoVaTen,
          ngaySinh: row.ngaySinh ? new Date(row.ngaySinh) : undefined,
          gioiTinh: row.gioiTinh,
          soDienThoai: row.soDienThoai,
          soGiayTo: row.soGiayTo,
          diaChi: row.diaChi,
          email: row.email,
          roleCode: row.role,
          isActive: row.isActive ?? true,
          assignedRoutes: row.routeIds.length
            ? {
                connect: row.routeIds.map((routeId) => ({ id: routeId })),
              }
            : undefined,
        },
      });
    }

    return {
      message: 'Import người dùng thành công',
      totalRows: normalizedRows.length,
      guide: {
        requiredColumns: [
          'taiKhoan',
          'matKhau',
          'hoVaTen',
          'soDienThoai',
          'soGiayTo',
        ],
        optionalColumns: [
          'ngaySinh',
          'gioiTinh',
          'diaChi',
          'email',
          'role',
          'routeIds',
          'isActive',
        ],
        routeIdsFormat: '1,2,3',
      },
    };
  }

  private validateRequiredFields(data: CreateUserDto) {
    if (!data.taiKhoan?.trim()) {
      throw new BadRequestException('Trường tài khoản là bắt buộc');
    }

    if (!data.matKhau?.trim()) {
      throw new BadRequestException('Trường mật khẩu là bắt buộc');
    }

    if (!data.hoVaTen?.trim()) {
      throw new BadRequestException('Trường họ và tên là bắt buộc');
    }

    if (!data.soDienThoai?.trim()) {
      throw new BadRequestException('Trường số điện thoại là bắt buộc');
    }

    if (!data.soGiayTo?.trim()) {
      throw new BadRequestException('Trường số giấy tờ là bắt buộc');
    }
  }

  private readonly userSelect = {
    id: true,
    taiKhoan: true,
    hoVaTen: true,
    ngaySinh: true,
    gioiTinh: true,
    soDienThoai: true,
    soGiayTo: true,
    diaChi: true,
    email: true,
    roleCode: true,
    role: {
      select: {
        code: true,
        label: true,
      },
    },
    assignedRoutes: {
      select: {
        id: true,
        maTuyen: true,
        tenTuyen: true,
      },
    },
    isActive: true,
    createdAt: true,
    updatedAt: true,
  };

  private toUserResponse(user: {
    id: number;
    taiKhoan: string;
    hoVaTen: string;
    ngaySinh: Date | null;
    gioiTinh: string | null;
    soDienThoai: string;
    soGiayTo: string;
    diaChi: string | null;
    email: string | null;
    roleCode: string;
    role: { code: string; label: string } | null;
    assignedRoutes: { id: number; maTuyen: string; tenTuyen: string }[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      taiKhoan: user.taiKhoan,
      hoVaTen: user.hoVaTen,
      ngaySinh: user.ngaySinh,
      gioiTinh: user.gioiTinh,
      soDienThoai: user.soDienThoai,
      soGiayTo: user.soGiayTo,
      diaChi: user.diaChi,
      email: user.email,
      role: user.roleCode,
      roleLabel: user.role?.label ?? user.roleCode,
      routeIds: user.assignedRoutes.map((route) => route.id),
      assignedRoutes: user.assignedRoutes,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private normalizeRouteIds(routeIds?: number[]) {
    if (!routeIds || !Array.isArray(routeIds)) {
      return [];
    }

    return Array.from(
      new Set(routeIds.filter((id) => Number.isInteger(id) && id > 0)),
    );
  }

  private async ensureRoutesExist(routeIds: number[]) {
    if (!routeIds.length) {
      return;
    }

    const existingRoutes = await this.prisma.route.findMany({
      where: { id: { in: routeIds } },
      select: { id: true },
    });

    if (existingRoutes.length !== routeIds.length) {
      throw new BadRequestException('Có tuyến đường không tồn tại');
    }
  }

  private async ensureRoleExists(roleCode: string) {
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) {
      throw new BadRequestException('Quyền không tồn tại');
    }
  }

  private toText(value: unknown) {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  }

  private toOptionalText(value: unknown) {
    const normalized = this.toText(value);
    return normalized || undefined;
  }

  private toOptionalNumberArray(value: unknown) {
    const normalized = this.toText(value);
    if (!normalized) {
      return [];
    }

    const values = normalized
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => Number(item));

    if (values.some((item) => !Number.isInteger(item) || item <= 0)) {
      throw new BadRequestException(`routeIds không hợp lệ: ${normalized}`);
    }

    return Array.from(new Set(values));
  }

  private toOptionalBoolean(value: unknown) {
    const normalized = this.toText(value).toLowerCase();
    if (!normalized) {
      return undefined;
    }

    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }

    throw new BadRequestException(`isActive không hợp lệ: ${value}`);
  }
}
