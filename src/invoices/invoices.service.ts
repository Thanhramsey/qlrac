import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoicePaymentStatus, Prisma } from '@prisma/client';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { buildVietQRImageUrl, generateVietQREMVCo } from '../common/vietqr.helper';

type PublishSettings = {
  publishServiceUrl: string;
  portalServiceUrl: string;
  wsUserId: string;
  wsPasswordId: string;
  cUserId: string;
  cPasswordId: string;
  mauSoHoaDon: string;
  kyHieuHoaDon: string;
  tenDonVi: string;
  maSoThue: string;
  diaChi: string;
  soDienThoai: string;
};

type PublishCredential = {
  account: string;
  acpass: string;
  username: string;
  password: string;
  label: 'DEFAULT' | 'SWAPPED';
};

type PublishResult = {
  success: boolean;
  message: string;
  serial: string | null;
  fkey: string | null;
  errorCode: number | null;
};

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMobileCollectionFilters(currentUser?: JwtPayload) {
    const routeWhere: Prisma.RouteWhereInput =
      currentUser?.role === 'STAFF'
        ? {
            staffId: currentUser.sub,
          }
        : {};

    const [billingPeriods, routes, serviceCatalogs] = await this.prisma.$transaction([
      this.prisma.billingPeriod.findMany({
        orderBy: [{ ngayBatDau: 'desc' }, { id: 'desc' }],
        take: 24,
        select: {
          id: true,
          maKy: true,
          tenKy: true,
          ngayBatDau: true,
          ngayKetThuc: true,
          isClosed: true,
        },
      }),
      this.prisma.route.findMany({
        where: routeWhere,
        orderBy: [{ tenTuyen: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          maTuyen: true,
          tenTuyen: true,
          staffId: true,
          staff: {
            select: {
              id: true,
              hoVaTen: true,
              taiKhoan: true,
            },
          },
        },
      }),
      this.prisma.serviceCatalog.findMany({
        where: { isActive: true },
        orderBy: [{ tenDichVu: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          maDichVu: true,
          tenDichVu: true,
          giaDichVu: true,
          thuePhanTram: true,
        },
      }),
    ]);

    return {
      billingPeriods,
      routes,
      serviceCatalogs: serviceCatalogs.map((item) => ({
        ...item,
        giaDichVu: Number(item.giaDichVu),
        thuePhanTram: Number(item.thuePhanTram),
      })),
    };
  }

  async getMobileCollectionHouseholds(
    currentUser: JwtPayload | undefined,
    params: {
      page?: number;
      limit?: number;
      kyHoaDons?: string[];
      tuyenThuRacIds?: number[];
      serviceCatalogIds?: number[];
      keyword?: string;
    },
  ) {
    const normalizedPage = Number.isFinite(params.page) && (params.page ?? 0) > 0 ? Number(params.page) : 1;
    const normalizedLimit = Number.isFinite(params.limit)
      ? Math.min(Math.max(Number(params.limit), 1), 100)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const kyHoaDons = [...new Set((params.kyHoaDons ?? []).map((item) => item.trim()).filter(Boolean))];
    const keyword = params.keyword?.trim() || undefined;

    const allowedRouteIds =
      currentUser?.role === 'STAFF'
        ? (
            await this.prisma.route.findMany({
              where: { staffId: currentUser.sub },
              select: { id: true },
            })
          ).map((item) => item.id)
        : null;

    if (currentUser?.role === 'STAFF' && allowedRouteIds && allowedRouteIds.length === 0) {
      return {
        data: [],
        pagination: {
          page: normalizedPage,
          limit: normalizedLimit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const resolvedRouteIds = [...new Set((params.tuyenThuRacIds ?? []).filter((id) => Number.isInteger(id) && id > 0))];
    const resolvedServiceIds = [...new Set((params.serviceCatalogIds ?? []).filter((id) => Number.isInteger(id) && id > 0))];

    if (currentUser?.role === 'STAFF' && allowedRouteIds) {
      if (resolvedRouteIds.some((routeId) => !allowedRouteIds.includes(routeId))) {
        throw new BadRequestException('Tuyến thu gom không thuộc nhân viên hiện tại');
      }
    }

    const routeIdFilter =
      resolvedRouteIds.length > 0
        ? resolvedRouteIds
        : allowedRouteIds && allowedRouteIds.length > 0
          ? allowedRouteIds
          : undefined;

    const where: Prisma.InvoiceWhereInput = {
      isActive: true,
      ...(kyHoaDons.length > 0 ? { kyHoaDon: { in: kyHoaDons } } : {}),
      household: {
        ...(keyword
          ? {
              OR: [
                { tenChuHo: { contains: keyword, mode: 'insensitive' } },
                { maHoDan: { contains: keyword, mode: 'insensitive' } },
                { diaChi: { contains: keyword, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(routeIdFilter ? { tuyenThuRacId: { in: routeIdFilter } } : {}),
        ...(resolvedServiceIds.length > 0 ? { serviceCatalogId: { in: resolvedServiceIds } } : {}),
      },
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: normalizedLimit,
        orderBy: [{ kyHoaDon: 'desc' }, { id: 'desc' }],
        include: {
          household: {
            select: {
              id: true,
              maHoDan: true,
              tenChuHo: true,
              diaChi: true,
              soDienThoai: true,
              tuyenThuRac: {
                select: {
                  id: true,
                  maTuyen: true,
                  tenTuyen: true,
                  staff: {
                    select: {
                      id: true,
                      hoVaTen: true,
                      taiKhoan: true,
                    },
                  },
                },
              },
              serviceCatalog: {
                select: {
                  id: true,
                  maDichVu: true,
                  tenDichVu: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: rows.map((item) => ({
        id: item.id,
        householdId: item.householdId,
        kyHoaDon: item.kyHoaDon,
        trangThaiThanhToan: item.trangThaiThanhToan,
        tongTien: Number(item.tongTien),
        thue: Number(item.thue),
        tongCong: Number(item.tongTien) + Number(item.thue),
        paymentDate: item.paymentDate,
        paymentNote: item.paymentNote,
        receiptImageUrl: item.receiptImageUrl,
        invoicePublishStatus: item.invoicePublishStatus,
        invoiceSerial: item.invoiceSerial,
        invoiceFkey: item.invoiceFkey,
        household: item.household,
      })),
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        totalPages: Math.ceil(total / normalizedLimit),
      },
    };
  }

  async getMobileUnpaidHouseholdCount(
    currentUser: JwtPayload | undefined,
    params: {
      kyHoaDons?: string[];
      tuyenThuRacIds?: number[];
      serviceCatalogIds?: number[];
      keyword?: string;
    },
  ) {
    let kyHoaDons = [...new Set((params.kyHoaDons ?? []).map((item) => item.trim()).filter(Boolean))];
    const keyword = params.keyword?.trim() || undefined;

    const allowedRouteIds =
      currentUser?.role === 'STAFF'
        ? (
            await this.prisma.route.findMany({
              where: { staffId: currentUser.sub },
              select: { id: true },
            })
          ).map((item) => item.id)
        : null;

    if (currentUser?.role === 'STAFF' && allowedRouteIds && allowedRouteIds.length === 0) {
      return {
        kyHoaDons,
        unpaidHouseholdCount: 0,
      };
    }

    const resolvedRouteIds = [...new Set((params.tuyenThuRacIds ?? []).filter((id) => Number.isInteger(id) && id > 0))];
    const resolvedServiceIds = [...new Set((params.serviceCatalogIds ?? []).filter((id) => Number.isInteger(id) && id > 0))];

    if (currentUser?.role === 'STAFF' && allowedRouteIds) {
      if (resolvedRouteIds.some((routeId) => !allowedRouteIds.includes(routeId))) {
        throw new BadRequestException('Tuyến thu gom không thuộc nhân viên hiện tại');
      }
    }

    const routeIdFilter =
      resolvedRouteIds.length > 0
        ? resolvedRouteIds
        : allowedRouteIds && allowedRouteIds.length > 0
          ? allowedRouteIds
          : undefined;

    const unpaidHouseholdCount = await this.prisma.invoice.count({
      where: {
        ...(kyHoaDons.length > 0 ? { kyHoaDon: { in: kyHoaDons } } : {}),
        trangThaiThanhToan: { not: InvoicePaymentStatus.PAID },
        household: {
          ...(keyword
            ? {
                OR: [
                  { tenChuHo: { contains: keyword, mode: 'insensitive' } },
                  { maHoDan: { contains: keyword, mode: 'insensitive' } },
                  { diaChi: { contains: keyword, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(routeIdFilter ? { tuyenThuRacId: { in: routeIdFilter } } : {}),
          ...(resolvedServiceIds.length > 0 ? { serviceCatalogId: { in: resolvedServiceIds } } : {}),
        },
      },
    });

    return {
      kyHoaDons,
      unpaidHouseholdCount,
    };
  }

  async findAll(
    page = 1,
    limit = 20,
    filters?: {
      kyHoaDon?: string;
      tenChuHo?: string;
      diaChi?: string;
      tuyenThuRacId?: number;
      serviceCatalogId?: number;
      trangThaiThanhToan?: InvoicePaymentStatus;
    },
  ) {
    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const where: Prisma.InvoiceWhereInput = {
      isActive: true,
      kyHoaDon: filters?.kyHoaDon?.trim() || undefined,
      trangThaiThanhToan: filters?.trangThaiThanhToan,
      household: {
        tenChuHo: filters?.tenChuHo
          ? { contains: filters.tenChuHo.trim(), mode: 'insensitive' }
          : undefined,
        diaChi: filters?.diaChi
          ? { contains: filters.diaChi.trim(), mode: 'insensitive' }
          : undefined,
        tuyenThuRacId: filters?.tuyenThuRacId,
        serviceCatalogId: filters?.serviceCatalogId,
      },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: normalizedLimit,
        orderBy: [{ kyHoaDon: 'desc' }, { id: 'desc' }],
        include: {
          household: {
            select: {
              id: true,
              maHoDan: true,
              tenChuHo: true,
              diaChi: true,
              tuyenThuRacId: true,
              serviceCatalogId: true,
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
                },
              },
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
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
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, isActive: true },
      include: {
        household: {
          select: {
            id: true,
            maHoDan: true,
            tenChuHo: true,
            diaChi: true,
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
              },
            },
          },
        },
      },
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
        paymentDate: createInvoiceDto.paymentDate
          ? new Date(createInvoiceDto.paymentDate)
          : undefined,
        paymentNote: createInvoiceDto.paymentNote,
        receiptImageUrl: createInvoiceDto.receiptImageUrl,
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
        paymentDate: updateInvoiceDto.paymentDate
          ? new Date(updateInvoiceDto.paymentDate)
          : undefined,
        paymentNote: updateInvoiceDto.paymentNote,
        receiptImageUrl: updateInvoiceDto.receiptImageUrl,
        hanThanhToan: updateInvoiceDto.hanThanhToan
          ? new Date(updateInvoiceDto.hanThanhToan)
          : undefined,
      },
    });
  }

  async ensureInvoicesForPeriod(period: {
    maKy: string;
    ngayKetThuc: Date;
  }) {
    const households = await this.prisma.household.findMany({
      where: { isActive: true },
      select: {
        id: true,
        serviceCatalog: {
          select: {
            giaDichVu: true,
            thuePhanTram: true,
          },
        },
      },
    });

    if (households.length === 0) {
      return { created: 0, totalHouseholds: 0 };
    }

    const existingInvoices = await this.prisma.invoice.findMany({
      where: { kyHoaDon: period.maKy },
      select: { householdId: true },
    });

    const existingHouseholdIds = new Set(existingInvoices.map((item) => item.householdId));

    const invoicesToCreate = households
      .filter((item) => !existingHouseholdIds.has(item.id))
      .map((item) => {
        const giaDichVu = Number(item.serviceCatalog?.giaDichVu ?? 0);
        const thuePhanTram = Number(item.serviceCatalog?.thuePhanTram ?? 0);
        const thue = Number(((giaDichVu * thuePhanTram) / 100).toFixed(2));

        return {
          householdId: item.id,
          kyHoaDon: period.maKy,
          tongTien: giaDichVu,
          thue,
          trangThaiThanhToan: InvoicePaymentStatus.UNPAID,
          hanThanhToan: period.ngayKetThuc,
        };
      });

    if (invoicesToCreate.length > 0) {
      await this.prisma.invoice.createMany({ data: invoicesToCreate });
    }

    return {
      created: invoicesToCreate.length,
      totalHouseholds: households.length,
    };
  }

  async generateForPeriod(maKy: string) {
    const periodCode = maKy?.trim();
    if (!periodCode) {
      throw new BadRequestException('Mã kỳ là bắt buộc');
    }

    const period = await this.prisma.billingPeriod.findUnique({ where: { maKy: periodCode } });
    if (!period) {
      throw new NotFoundException(`Kỳ hóa đơn ${periodCode} không tồn tại`);
    }

    const result = await this.ensureInvoicesForPeriod({
      maKy: period.maKy,
      ngayKetThuc: period.ngayKetThuc,
    });

    return {
      message: 'Đã kiểm tra và phát sinh hóa đơn theo kỳ',
      ...result,
      maKy: period.maKy,
    };
  }

  async collectInvoices(
    invoiceIds: number[],
    paymentNote?: string,
    receiptImageUrl?: string,
    currentUser?: JwtPayload,
  ) {
    const normalizedIds = [...new Set((invoiceIds ?? []).filter((id) => Number.isInteger(id) && id > 0))];
    if (normalizedIds.length === 0) {
      throw new BadRequestException('Danh sách hóa đơn thu tiền không hợp lệ');
    }

    const existing = await this.prisma.invoice.findMany({
      where: { id: { in: normalizedIds }, isActive: true },
      select: { id: true },
    });

    if (existing.length !== normalizedIds.length) {
      throw new BadRequestException('Có hóa đơn không tồn tại trong danh sách thu tiền');
    }

    const now = new Date();
    const updateResult = await this.prisma.invoice.updateMany({
      where: {
        id: { in: normalizedIds },
        isActive: true,
        trangThaiThanhToan: { not: InvoicePaymentStatus.PAID },
      },
      data: {
        trangThaiThanhToan: InvoicePaymentStatus.PAID,
        paymentDate: now,
        paymentNote: paymentNote?.trim() || null,
        receiptImageUrl: receiptImageUrl ?? null,
        collectedById: currentUser?.sub,
        collectedByName: currentUser?.hoVaTen || currentUser?.taiKhoan || null,
      },
    });

    const updatedInvoices = await this.prisma.invoice.findMany({
      where: { id: { in: normalizedIds }, isActive: true },
      include: {
        household: {
          select: {
            id: true,
            maHoDan: true,
            tenChuHo: true,
            diaChi: true,
          },
        },
      },
      orderBy: [{ kyHoaDon: 'desc' }, { id: 'desc' }],
    });

    return {
      message: 'Thu tiền thành công',
      updatedCount: updateResult.count,
      invoices: updatedInvoices,
    };
  }

  async getHouseholdHistory(householdId: number) {
    const household = await this.prisma.household.findUnique({
      where: { id: householdId },
      select: {
        id: true,
        maHoDan: true,
        tenChuHo: true,
        diaChi: true,
      },
    });

    if (!household) {
      throw new NotFoundException('Hộ dân không tồn tại');
    }

    const invoices = await this.prisma.invoice.findMany({
      where: { householdId, isActive: true },
      orderBy: [{ kyHoaDon: 'desc' }, { id: 'desc' }],
    });

    const paidCount = invoices.filter((item) => item.trangThaiThanhToan === 'PAID').length;
    const unpaidCount = invoices.length - paidCount;

    return {
      household,
      summary: {
        total: invoices.length,
        paid: paidCount,
        unpaid: unpaidCount,
      },
      invoices,
    };
  }

  async getReceiptPayload(invoiceIds: number[]) {
    const normalizedIds = [...new Set((invoiceIds ?? []).filter((id) => Number.isInteger(id) && id > 0))];
    if (normalizedIds.length === 0) {
      throw new BadRequestException('Danh sách hóa đơn in phiếu không hợp lệ');
    }

    const invoices = await this.prisma.invoice.findMany({
      where: { id: { in: normalizedIds } },
      include: {
        household: {
          select: {
            id: true,
            maHoDan: true,
            tenChuHo: true,
            diaChi: true,
            soDienThoai: true,
            tuyenThuRac: {
              select: {
                maTuyen: true,
                tenTuyen: true,
              },
            },
            serviceCatalog: {
              select: {
                maDichVu: true,
                tenDichVu: true,
              },
            },
          },
        },
      },
      orderBy: [{ householdId: 'asc' }, { kyHoaDon: 'desc' }],
    });

    if (invoices.length === 0) {
      throw new NotFoundException('Không tìm thấy hóa đơn để in phiếu');
    }

    const totalAmount = invoices.reduce((sum, item) => sum + Number(item.tongTien) + Number(item.thue), 0);

    // Fetch system parameters for receipt header/footer
    const systemParams = await this.prisma.systemParameter.findMany({
      where: {
        tenThamSo: {
          in: [
            'Tên đơn vị',
            'Địa chỉ',
            'Số điện thoại',
            'Số tài khoản ngân hàng',
            'Mã ngân hàng',
            'Tên ngân hàng / Mã ngân hàng',
            'Tên chủ tài khoản',
            'PORTAL_SERVICE_ADDRESS_ID',
            'QR thanh toán',
          ],
        },
      },
    });

    const paramsMap = new Map(systemParams.map((item) => [item.tenThamSo, item.giaTri?.trim() ?? '']));
    const companyAccountNumber = paramsMap.get('Số tài khoản ngân hàng') || '';
    const bankCode = paramsMap.get('Mã ngân hàng') || paramsMap.get('Tên ngân hàng / Mã ngân hàng') || '970415';
    const accountName = paramsMap.get('Tên chủ tài khoản') || paramsMap.get('Tên đơn vị') || '';
    const firstInvoice = invoices[0];
    const householdCode = firstInvoice?.household?.maHoDan || '';
    const memo = `TT TIEN RAC ${householdCode}`.trim();

    let qrThanhToan = paramsMap.get('QR thanh toán') || '';
    let vietQrPayload = '';

    if (companyAccountNumber) {
      vietQrPayload = generateVietQREMVCo({
        bankBin: bankCode,
        accountNo: companyAccountNumber,
        amount: totalAmount,
        memo,
      });

      // If qrThanhToan is not a custom external URL or custom payload string, generate VietQR Quick Link
      if (!qrThanhToan || qrThanhToan.startsWith('/') || !qrThanhToan.startsWith('http')) {
        qrThanhToan = buildVietQRImageUrl({
          bankBin: bankCode,
          accountNo: companyAccountNumber,
          accountName,
          amount: totalAmount,
          memo,
        });
      }
    } else if (qrThanhToan && qrThanhToan.startsWith('000201')) {
      vietQrPayload = qrThanhToan;
    }

    return {
      generatedAt: new Date().toISOString(),
      totalInvoices: invoices.length,
      totalAmount,
      companyName: paramsMap.get('Tên đơn vị') || 'CÔNG TRÌNH ĐÔ THỊ AN KHÊ',
      companyAddress: paramsMap.get('Địa chỉ') || '',
      companyPhone: paramsMap.get('Số điện thoại') || '',
      companyAccountNumber,
      portalUrl: paramsMap.get('PORTAL_SERVICE_ADDRESS_ID') || '',
      qrThanhToan,
      vietQrPayload,
      invoices,
    };
  }

  async getDetailReportByPeriod(params: {
    kyHoaDon?: string;
    collectorId?: number;
    routeId?: number;
    page?: number;
    limit?: number;
  }) {
    const kyHoaDon = params.kyHoaDon?.trim();
    if (!kyHoaDon) {
      throw new BadRequestException('Vui lòng chọn kỳ hóa đơn');
    }

    const normalizedPage = Number.isFinite(params.page) && (params.page ?? 0) > 0 ? Number(params.page) : 1;
    const normalizedLimit = Number.isFinite(params.limit)
      ? Math.min(Math.max(Number(params.limit), 1), 200)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const paidStatus = InvoicePaymentStatus.PAID;
    const where: Prisma.InvoiceWhereInput = {
      isActive: true,
      kyHoaDon,
      trangThaiThanhToan: paidStatus,
      household: {
        tuyenThuRacId:
          Number.isInteger(params.routeId) && (params.routeId ?? 0) > 0
            ? Number(params.routeId)
            : undefined,
        tuyenThuRac: {
          staffId:
            Number.isInteger(params.collectorId) && (params.collectorId ?? 0) > 0
              ? Number(params.collectorId)
              : undefined,
        },
      },
    };

    const [rows, totalRows] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: normalizedLimit,
        orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
        include: {
          household: {
            select: {
              id: true,
              maHoDan: true,
              tenChuHo: true,
              diaChi: true,
              tuyenThuRac: {
                select: {
                  id: true,
                  maTuyen: true,
                  tenTuyen: true,
                  staff: {
                    select: {
                      id: true,
                      hoVaTen: true,
                      taiKhoan: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const mappedRows = rows.map((item) => {
      const totalAmount = Number(item.tongTien) + Number(item.thue);
      return {
        invoiceId: item.id,
        kyHoaDon: item.kyHoaDon,
        maHoDan: item.household?.maHoDan ?? '---',
        tenChuHo: item.household?.tenChuHo ?? '---',
        diaChi: item.household?.diaChi ?? '---',
        tuyenThuRac: item.household?.tuyenThuRac?.tenTuyen ?? '---',
        nguoiThu:
          item.household?.tuyenThuRac?.staff?.hoVaTen ||
          item.household?.tuyenThuRac?.staff?.taiKhoan ||
          '---',
        invoiceSerial: item.invoiceSerial,
        invoiceFkey: item.invoiceFkey,
        daPhatHanh: item.invoicePublishStatus === 'SUCCESS',
        tongTien: Number(item.tongTien),
        thue: Number(item.thue),
        tongCong: totalAmount,
        paymentDate: item.paymentDate,
      };
    });

    const sum = mappedRows.reduce(
      (acc, item) => {
        acc.tongTien += item.tongTien;
        acc.thue += item.thue;
        acc.tongCong += item.tongCong;
        if (item.daPhatHanh) {
          acc.soHoaDonDaPhatHanh += 1;
        }
        return acc;
      },
      {
        soHoDaThu: mappedRows.length,
        soHoaDonDaPhatHanh: 0,
        tongTien: 0,
        thue: 0,
        tongCong: 0,
      },
    );

    return {
      data: mappedRows,
      summary: sum,
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total: totalRows,
        totalPages: Math.ceil(totalRows / normalizedLimit),
      },
    };
  }

  async getDetailReportByPeriodRange(params: {
    fromKy?: string;
    toKy?: string;
    collectorId?: number;
    routeId?: number;
    page?: number;
    limit?: number;
  }) {
    const fromKy = params.fromKy?.trim();
    const toKy = params.toKy?.trim();

    if (!fromKy || !toKy) {
      throw new BadRequestException('Vui lòng chọn Từ kỳ và Đến kỳ');
    }

    const [fromPeriod, toPeriod] = await this.prisma.$transaction([
      this.prisma.billingPeriod.findUnique({ where: { maKy: fromKy } }),
      this.prisma.billingPeriod.findUnique({ where: { maKy: toKy } }),
    ]);

    if (!fromPeriod || !toPeriod) {
      throw new BadRequestException('Kỳ hóa đơn không tồn tại');
    }

    if (fromPeriod.ngayBatDau > toPeriod.ngayKetThuc) {
      throw new BadRequestException('Từ kỳ phải nhỏ hơn hoặc bằng Đến kỳ');
    }

    const periods = await this.prisma.billingPeriod.findMany({
      where: {
        ngayBatDau: { gte: fromPeriod.ngayBatDau },
        ngayKetThuc: { lte: toPeriod.ngayKetThuc },
      },
      select: { maKy: true },
      orderBy: { ngayBatDau: 'asc' },
    });

    const kyList = periods.map((item) => item.maKy);
    if (kyList.length === 0) {
      return {
        data: [],
        summary: {
          soHoDaThu: 0,
          soHoaDonDaPhatHanh: 0,
          tongTien: 0,
          thue: 0,
          tongCong: 0,
        },
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const normalizedPage = Number.isFinite(params.page) && (params.page ?? 0) > 0 ? Number(params.page) : 1;
    const normalizedLimit = Number.isFinite(params.limit)
      ? Math.min(Math.max(Number(params.limit), 1), 200)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const where: Prisma.InvoiceWhereInput = {
      isActive: true,
      kyHoaDon: { in: kyList },
      trangThaiThanhToan: InvoicePaymentStatus.PAID,
      household: {
        tuyenThuRacId:
          Number.isInteger(params.routeId) && (params.routeId ?? 0) > 0
            ? Number(params.routeId)
            : undefined,
        tuyenThuRac: {
          staffId:
            Number.isInteger(params.collectorId) && (params.collectorId ?? 0) > 0
              ? Number(params.collectorId)
              : undefined,
        },
      },
    };

    const [rows, totalRows] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: normalizedLimit,
        orderBy: [{ kyHoaDon: 'asc' }, { paymentDate: 'desc' }, { id: 'desc' }],
        include: {
          household: {
            select: {
              id: true,
              maHoDan: true,
              tenChuHo: true,
              diaChi: true,
              tuyenThuRac: {
                select: {
                  id: true,
                  maTuyen: true,
                  tenTuyen: true,
                  staff: {
                    select: {
                      id: true,
                      hoVaTen: true,
                      taiKhoan: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const mappedRows = rows.map((item) => {
      const totalAmount = Number(item.tongTien) + Number(item.thue);
      return {
        invoiceId: item.id,
        kyHoaDon: item.kyHoaDon,
        maHoDan: item.household?.maHoDan ?? '---',
        tenChuHo: item.household?.tenChuHo ?? '---',
        diaChi: item.household?.diaChi ?? '---',
        tuyenThuRac: item.household?.tuyenThuRac?.tenTuyen ?? '---',
        nguoiThu:
          item.household?.tuyenThuRac?.staff?.hoVaTen ||
          item.household?.tuyenThuRac?.staff?.taiKhoan ||
          '---',
        invoiceSerial: item.invoiceSerial,
        invoiceFkey: item.invoiceFkey,
        daPhatHanh: item.invoicePublishStatus === 'SUCCESS',
        tongTien: Number(item.tongTien),
        thue: Number(item.thue),
        tongCong: totalAmount,
        paymentDate: item.paymentDate,
      };
    });

    const sum = mappedRows.reduce(
      (acc, item) => {
        acc.tongTien += item.tongTien;
        acc.thue += item.thue;
        acc.tongCong += item.tongCong;
        if (item.daPhatHanh) {
          acc.soHoaDonDaPhatHanh += 1;
        }
        return acc;
      },
      {
        soHoDaThu: mappedRows.length,
        soHoaDonDaPhatHanh: 0,
        tongTien: 0,
        thue: 0,
        tongCong: 0,
      },
    );

    return {
      data: mappedRows,
      summary: sum,
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total: totalRows,
        totalPages: Math.ceil(totalRows / normalizedLimit),
      },
    };
  }

  async getDetailReportByDate(params: {
    fromDate?: string;
    toDate?: string;
    collectorId?: number;
    routeId?: number;
    page?: number;
    limit?: number;
  }) {
    const fromDate = params.fromDate ? new Date(params.fromDate) : null;
    const toDate = params.toDate ? new Date(params.toDate) : null;

    if (!fromDate || Number.isNaN(fromDate.getTime())) {
      throw new BadRequestException('Từ ngày không hợp lệ');
    }

    if (!toDate || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Tới ngày không hợp lệ');
    }

    if (fromDate > toDate) {
      throw new BadRequestException('Từ ngày phải nhỏ hơn hoặc bằng Tới ngày');
    }

    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const normalizedPage = Number.isFinite(params.page) && (params.page ?? 0) > 0 ? Number(params.page) : 1;
    const normalizedLimit = Number.isFinite(params.limit)
      ? Math.min(Math.max(Number(params.limit), 1), 200)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const where: Prisma.InvoiceWhereInput = {
      isActive: true,
      trangThaiThanhToan: InvoicePaymentStatus.PAID,
      paymentDate: {
        gte: from,
        lte: to,
      },
      household: {
        tuyenThuRacId:
          Number.isInteger(params.routeId) && (params.routeId ?? 0) > 0
            ? Number(params.routeId)
            : undefined,
        tuyenThuRac: {
          staffId:
            Number.isInteger(params.collectorId) && (params.collectorId ?? 0) > 0
              ? Number(params.collectorId)
              : undefined,
        },
      },
    };

    const [rows, totalRows] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: normalizedLimit,
        orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
        include: {
          household: {
            select: {
              id: true,
              maHoDan: true,
              tenChuHo: true,
              diaChi: true,
              tuyenThuRac: {
                select: {
                  id: true,
                  maTuyen: true,
                  tenTuyen: true,
                  staff: {
                    select: {
                      id: true,
                      hoVaTen: true,
                      taiKhoan: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const mappedRows = rows.map((item) => {
      const totalAmount = Number(item.tongTien) + Number(item.thue);
      const payDate = item.paymentDate ? new Date(item.paymentDate) : null;
      const payDateKey = payDate ? payDate.toISOString().slice(0, 10) : 'N/A';

      return {
        invoiceId: item.id,
        kyHoaDon: item.kyHoaDon,
        maHoDan: item.household?.maHoDan ?? '---',
        tenChuHo: item.household?.tenChuHo ?? '---',
        diaChi: item.household?.diaChi ?? '---',
        tuyenThuRac: item.household?.tuyenThuRac?.tenTuyen ?? '---',
        nguoiThu:
          item.household?.tuyenThuRac?.staff?.hoVaTen ||
          item.household?.tuyenThuRac?.staff?.taiKhoan ||
          '---',
        invoiceSerial: item.invoiceSerial,
        invoiceFkey: item.invoiceFkey,
        daPhatHanh: item.invoicePublishStatus === 'SUCCESS',
        tongTien: Number(item.tongTien),
        thue: Number(item.thue),
        tongCong: totalAmount,
        paymentDate: item.paymentDate,
        paymentDateKey: payDateKey,
      };
    });

    const dailyMap = new Map<string, { tongCong: number; soHoDaThu: number }>();
    for (const item of mappedRows) {
      const current = dailyMap.get(item.paymentDateKey) ?? { tongCong: 0, soHoDaThu: 0 };
      current.tongCong += item.tongCong;
      current.soHoDaThu += 1;
      dailyMap.set(item.paymentDateKey, current);
    }

    const tongHopTheoNgay = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ngayThuTien, val]) => ({
        ngayThuTien,
        soHoDaThu: val.soHoDaThu,
        tongTien: val.tongCong,
      }));

    const sum = mappedRows.reduce(
      (acc, item) => {
        acc.tongTien += item.tongTien;
        acc.thue += item.thue;
        acc.tongCong += item.tongCong;
        if (item.daPhatHanh) {
          acc.soHoaDonDaPhatHanh += 1;
        }
        return acc;
      },
      {
        soHoDaThu: mappedRows.length,
        soHoaDonDaPhatHanh: 0,
        tongTien: 0,
        thue: 0,
        tongCong: 0,
      },
    );

    return {
      data: mappedRows,
      summary: sum,
      tongHopTheoNgay,
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total: totalRows,
        totalPages: Math.ceil(totalRows / normalizedLimit),
      },
    };
  }

  async getRevenueSummaryReport(params: {
    kyHoaDon?: string;
    routeId?: number;
    serviceCatalogId?: number;
    page?: number;
    limit?: number;
  }) {
    const kyHoaDon = params.kyHoaDon?.trim();
    if (!kyHoaDon) {
      throw new BadRequestException('Vui lòng chọn kỳ hóa đơn');
    }

    const normalizedPage = Number.isFinite(params.page) && (params.page ?? 0) > 0 ? Number(params.page) : 1;
    const normalizedLimit = Number.isFinite(params.limit)
      ? Math.min(Math.max(Number(params.limit), 1), 200)
      : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const householdFilter: Prisma.HouseholdWhereInput = {
      isActive: true,
      tuyenThuRacId:
        Number.isInteger(params.routeId) && (params.routeId ?? 0) > 0
          ? Number(params.routeId)
          : undefined,
      serviceCatalogId:
        Number.isInteger(params.serviceCatalogId) && (params.serviceCatalogId ?? 0) > 0
          ? Number(params.serviceCatalogId)
          : undefined,
    };

    const where: Prisma.InvoiceWhereInput = {
      isActive: true,
      kyHoaDon,
      household: householdFilter,
    };

    const [rows, totalRows] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: normalizedLimit,
        orderBy: [{ id: 'desc' }],
        include: {
          household: {
            select: {
              id: true,
              maHoDan: true,
              tenChuHo: true,
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
                },
              },
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const groupMap = new Map<
      string,
      {
        kyHoaDon: string;
        tuyenThuRacId: number | null;
        tuyenThuRac: string;
        serviceCatalogId: number | null;
        loaiDichVu: string;
        soHo: Set<number>;
        soHoDaThu: Set<number>;
        soHoChuaThu: Set<number>;
        tongTien: number;
        tongThue: number;
        tongCong: number;
        daThuTien: number;
        daThuThue: number;
        daThuCong: number;
        chuaThuTien: number;
        chuaThuThue: number;
        chuaThuCong: number;
      }
    >();

    for (const item of rows) {
      const routeId = item.household?.tuyenThuRac?.id ?? null;
      const routeName = item.household?.tuyenThuRac?.tenTuyen ?? '---';
      const serviceId = item.household?.serviceCatalog?.id ?? null;
      const serviceName = item.household?.serviceCatalog?.tenDichVu ?? '---';
      const key = `${routeId ?? 'none'}-${serviceId ?? 'none'}`;
      const totalAmount = Number(item.tongTien) + Number(item.thue);

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          kyHoaDon,
          tuyenThuRacId: routeId,
          tuyenThuRac: routeName,
          serviceCatalogId: serviceId,
          loaiDichVu: serviceName,
          soHo: new Set<number>(),
          soHoDaThu: new Set<number>(),
          soHoChuaThu: new Set<number>(),
          tongTien: 0,
          tongThue: 0,
          tongCong: 0,
          daThuTien: 0,
          daThuThue: 0,
          daThuCong: 0,
          chuaThuTien: 0,
          chuaThuThue: 0,
          chuaThuCong: 0,
        });
      }

      const group = groupMap.get(key)!;
      if (item.householdId) {
        group.soHo.add(item.householdId);
        if (item.trangThaiThanhToan === InvoicePaymentStatus.PAID) {
          group.soHoDaThu.add(item.householdId);
        } else {
          group.soHoChuaThu.add(item.householdId);
        }
      }

      group.tongTien += Number(item.tongTien);
      group.tongThue += Number(item.thue);
      group.tongCong += totalAmount;

      if (item.trangThaiThanhToan === InvoicePaymentStatus.PAID) {
        group.daThuTien += Number(item.tongTien);
        group.daThuThue += Number(item.thue);
        group.daThuCong += totalAmount;
      } else {
        group.chuaThuTien += Number(item.tongTien);
        group.chuaThuThue += Number(item.thue);
        group.chuaThuCong += totalAmount;
      }
    }

    const data = Array.from(groupMap.values()).map((item) => ({
      kyHoaDon: item.kyHoaDon,
      tuyenThuRacId: item.tuyenThuRacId,
      tuyenThuRac: item.tuyenThuRac,
      serviceCatalogId: item.serviceCatalogId,
      loaiDichVu: item.loaiDichVu,
      tongSoHo: item.soHo.size,
      daThuSoHo: item.soHoDaThu.size,
      chuaThuSoHo: item.soHoChuaThu.size,
      tongTien: item.tongTien,
      tongThue: item.tongThue,
      tongCong: item.tongCong,
      daThuTien: item.daThuTien,
      daThuThue: item.daThuThue,
      daThuCong: item.daThuCong,
      chuaThuTien: item.chuaThuTien,
      chuaThuThue: item.chuaThuThue,
      chuaThuCong: item.chuaThuCong,
    }));

    const summary = data.reduce(
      (acc, item) => {
        acc.tongSoHo += item.tongSoHo;
        acc.daThuSoHo += item.daThuSoHo;
        acc.chuaThuSoHo += item.chuaThuSoHo;
        acc.tongTien += item.tongTien;
        acc.tongThue += item.tongThue;
        acc.tongCong += item.tongCong;
        acc.daThuTien += item.daThuTien;
        acc.daThuThue += item.daThuThue;
        acc.daThuCong += item.daThuCong;
        acc.chuaThuTien += item.chuaThuTien;
        acc.chuaThuThue += item.chuaThuThue;
        acc.chuaThuCong += item.chuaThuCong;
        return acc;
      },
      {
        tongSoHo: 0,
        daThuSoHo: 0,
        chuaThuSoHo: 0,
        tongTien: 0,
        tongThue: 0,
        tongCong: 0,
        daThuTien: 0,
        daThuThue: 0,
        daThuCong: 0,
        chuaThuTien: 0,
        chuaThuThue: 0,
        chuaThuCong: 0,
      },
    );

    return {
      data,
      summary,
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total: totalRows,
        totalPages: Math.ceil(totalRows / normalizedLimit),
      },
    };
  }

  async updateStatus(id: number, status: InvoicePaymentStatus) {
    await this.findOne(id);

    const paymentDate = status === InvoicePaymentStatus.PAID ? new Date() : null;

    return this.prisma.invoice.update({
      where: { id },
      data: {
        trangThaiThanhToan: status,
        paymentDate,
      },
      include: {
        household: {
          select: {
            id: true,
            maHoDan: true,
            tenChuHo: true,
            diaChi: true,
          },
        },
      },
    });
  }

  async publishInvoices(invoiceIds: number[], currentUser?: JwtPayload) {
    const normalizedIds = [...new Set((invoiceIds ?? []).filter((id) => Number.isInteger(id) && id > 0))];
    if (normalizedIds.length === 0) {
      throw new BadRequestException('Danh sách hóa đơn phát hành không hợp lệ');
    }

    const settings = await this.loadPublishSettings();

    const invoices = await this.prisma.invoice.findMany({
      where: { id: { in: normalizedIds } },
      include: {
        household: {
          select: {
            maHoDan: true,
            tenChuHo: true,
            diaChi: true,
            soDienThoai: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    if (invoices.length !== normalizedIds.length) {
      throw new BadRequestException('Có hóa đơn không tồn tại trong danh sách phát hành');
    }

    const groupedByHousehold = new Map<number, typeof invoices>();
    for (const invoice of invoices) {
      const bucket = groupedByHousehold.get(invoice.householdId) ?? [];
      bucket.push(invoice);
      groupedByHousehold.set(invoice.householdId, bucket);
    }

    const results: Array<{
      invoiceId: number;
      success: boolean;
      message: string;
      invoiceSerial?: string | null;
      invoiceFkey?: string | null;
      invoiceIssuedAt?: string | null;
    }> = [];

    for (const householdInvoices of groupedByHousehold.values()) {
      const sortedInvoices = [...householdInvoices].sort((a, b) => a.kyHoaDon.localeCompare(b.kyHoaDon));
      const alreadyPublished = sortedInvoices.filter(
        (invoice) =>
          invoice.invoicePublishStatus === 'SUCCESS' ||
          !!invoice.invoiceFkey ||
          !!invoice.invoiceSerial,
      );

      if (alreadyPublished.length > 0) {
        for (const invoice of alreadyPublished) {
          if (invoice.trangThaiThanhToan !== InvoicePaymentStatus.PAID) {
            await this.prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                trangThaiThanhToan: InvoicePaymentStatus.PAID,
                paymentDate: invoice.paymentDate ?? new Date(),
              },
            });
          }

          results.push({
            invoiceId: invoice.id,
            success: false,
            message: 'Hóa đơn đã phát hành, không thể xuất lại. Vui lòng dùng chức năng Thay thế hóa đơn.',
          });
        }
      }

      const targetInvoices = sortedInvoices.filter((invoice) => !alreadyPublished.some((ap) => ap.id === invoice.id));
      if (targetInvoices.length === 0) {
        continue;
      }

      try {
        const xmlInvData = this.buildMergedXmlInvData(targetInvoices, settings);
        const credentialCandidates: PublishCredential[] = [
          {
            account: settings.wsUserId,
            acpass: settings.wsPasswordId,
            username: settings.cUserId,
            password: settings.cPasswordId,
            label: 'DEFAULT',
          },
          {
            account: settings.cUserId,
            acpass: settings.cPasswordId,
            username: settings.wsUserId,
            password: settings.wsPasswordId,
            label: 'SWAPPED',
          },
        ];

        let publishResult: PublishResult | null = null;

        for (const credential of credentialCandidates) {
          const responseText = await this.callPublishService(xmlInvData, settings, credential);
          publishResult = this.parsePublishResult(responseText);

          if (publishResult.success) {
            break;
          }

          // ERR:1 thường là lỗi xác thực/mapping account, thử thêm 1 lượt với mapping đảo.
          if (publishResult.errorCode !== 1 || credential.label === 'SWAPPED') {
            break;
          }
        }

        if (!publishResult) {
          throw new BadRequestException('Không đọc được phản hồi từ VNPT');
        }

        if (!publishResult.success) {
          const failMessage = publishResult.message || 'Phát hành thất bại';
          for (const invoice of targetInvoices) {
            await this.markPublishFailed(invoice.id, failMessage);
            results.push({
              invoiceId: invoice.id,
              success: false,
              message: failMessage,
            });
          }
          continue;
        }

        const issuedAt = new Date();
        const mergedPeriods = targetInvoices.map((item) => item.kyHoaDon).join(', ');

        await this.prisma.invoice.updateMany({
          where: { id: { in: targetInvoices.map((item) => item.id) } },
          data: {
            invoiceSerial: publishResult.serial,
            invoiceFkey: publishResult.fkey,
            invoiceIssuedAt: issuedAt,
            invoicePublishStatus: 'SUCCESS',
            invoicePublishMessage:
              (publishResult.message || 'Phát hành thành công') +
              (targetInvoices.length > 1 ? ` (Gộp kỳ: ${mergedPeriods})` : ''),
            mergedPeriodCodes: targetInvoices.length > 1 ? mergedPeriods : targetInvoices[0]?.kyHoaDon ?? null,
            publishedById: currentUser?.sub,
            publishedByName: currentUser?.hoVaTen || currentUser?.taiKhoan || null,
            // Nghiệp vụ hiện tại: xuất hóa đơn xong mặc định xác nhận đã thu.
            trangThaiThanhToan: InvoicePaymentStatus.PAID,
            paymentDate: issuedAt,
            collectedById: currentUser?.sub,
            collectedByName: currentUser?.hoVaTen || currentUser?.taiKhoan || null,
          },
        });

        for (const invoice of targetInvoices) {
          results.push({
            invoiceId: invoice.id,
            success: true,
            message:
              targetInvoices.length > 1
                ? `Đã phát hành gộp ${targetInvoices.length} kỳ thành 1 hóa đơn (${mergedPeriods})`
                : publishResult.message || 'Phát hành thành công',
            invoiceSerial: publishResult.serial,
            invoiceFkey: publishResult.fkey,
            invoiceIssuedAt: issuedAt.toISOString(),
          });
        }
      } catch (error) {
        const failMessage = error instanceof Error ? error.message : 'Không thể phát hành hóa đơn';
        for (const invoice of targetInvoices) {
          await this.markPublishFailed(invoice.id, failMessage);
          results.push({
            invoiceId: invoice.id,
            success: false,
            message: failMessage,
          });
        }
      }
    }

    const successCount = results.filter((item) => item.success).length;
    const failCount = results.length - successCount;

    return {
      message:
        failCount > 0
          ? `Đã phát hành ${successCount}/${results.length} hóa đơn. Có ${failCount} hóa đơn lỗi.`
          : `Đã phát hành thành công ${successCount} hóa đơn.`,
      total: results.length,
      successCount,
      failCount,
      results,
    };
  }

  async syncPublishMetadata(invoiceIds: number[]) {
    const normalizedIds = [...new Set((invoiceIds ?? []).filter((id) => Number.isInteger(id) && id > 0))];
    if (normalizedIds.length === 0) {
      throw new BadRequestException('Danh sách hóa đơn đồng bộ không hợp lệ');
    }

    const invoices = await this.prisma.invoice.findMany({
      where: { id: { in: normalizedIds } },
      select: {
        id: true,
        invoiceFkey: true,
        invoiceSerial: true,
        invoicePublishStatus: true,
        invoicePublishMessage: true,
      },
      orderBy: { id: 'asc' },
    });

    if (invoices.length !== normalizedIds.length) {
      throw new BadRequestException('Có hóa đơn không tồn tại trong danh sách đồng bộ');
    }

    const settings = await this.loadPublishSettings();
    const credentials = this.getCredentialCandidates(settings);
    const results: Array<{
      invoiceId: number;
      success: boolean;
      message: string;
      invoiceSerial?: string | null;
      invoiceFkey?: string | null;
    }> = [];

    for (const invoice of invoices) {
      try {
        let syncSerial: string | null = invoice.invoiceSerial;
        let syncFkey: string | null = invoice.invoiceFkey;

        // 1) Ưu tiên parse lại message phát hành đã lưu để tránh gọi VNPT không cần thiết.
        if ((!syncSerial || !syncFkey) && invoice.invoicePublishMessage) {
          const parsedFromMessage = this.parsePublishLikePayload(invoice.invoicePublishMessage);
          syncSerial = syncSerial || parsedFromMessage.serial;
          syncFkey = syncFkey || parsedFromMessage.fkey;
        }

        // 2) Nếu đã có fkey thì gọi VNPT lấy chi tiết để đồng bộ chính xác hơn.
        if (syncFkey) {
          const downloaded = await this.fetchInvoiceByFkeyFromVnpt(syncFkey, settings, credentials);
          const parsedFromDownload = this.parsePublishLikePayload(downloaded.rawMessage);
          syncSerial = syncSerial || parsedFromDownload.serial;
          syncFkey = syncFkey || parsedFromDownload.fkey;
        }

        if (!syncSerial && !syncFkey) {
          const failMessage = 'Đồng bộ thất bại: Không tìm thấy dữ liệu seri/fkey để cập nhật';
          await this.prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              invoicePublishStatus: 'FAILED',
              invoicePublishMessage: failMessage,
            },
          });

          results.push({
            invoiceId: invoice.id,
            success: false,
            message: failMessage,
          });
          continue;
        }

        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            invoiceSerial: syncSerial,
            invoiceFkey: syncFkey,
            invoicePublishStatus: invoice.invoicePublishStatus || 'SUCCESS',
            invoicePublishMessage: 'Đã đồng bộ seri/fkey thành công',
          },
        });

        results.push({
          invoiceId: invoice.id,
          success: true,
          message: 'Đồng bộ thành công',
          invoiceSerial: syncSerial,
          invoiceFkey: syncFkey,
        });
      } catch (error) {
        const failMessage = error instanceof Error ? error.message : 'Đồng bộ thất bại';
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            invoicePublishStatus: 'FAILED',
            invoicePublishMessage: `Đồng bộ thất bại: ${failMessage}`,
          },
        });

        results.push({
          invoiceId: invoice.id,
          success: false,
          message: failMessage,
        });
      }
    }

    const successCount = results.filter((item) => item.success).length;
    const failCount = results.length - successCount;

    return {
      message:
        failCount > 0
          ? `Đồng bộ ${successCount}/${results.length} hóa đơn thành công, ${failCount} hóa đơn lỗi.`
          : `Đồng bộ thành công ${successCount} hóa đơn.`,
      total: results.length,
      successCount,
      failCount,
      results,
    };
  }

  async replaceInvoice(invoiceId: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        household: {
          select: {
            maHoDan: true,
            tenChuHo: true,
            diaChi: true,
            soDienThoai: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Hóa đơn không tồn tại');
    }

    if (!invoice.invoiceFkey) {
      throw new BadRequestException('Hóa đơn chưa có Fkey để thực hiện thay thế');
    }

    const settings = await this.loadPublishSettings();
    const credentials = this.getCredentialCandidates(settings);
    const xmlInvData = this.buildReplaceXmlInvData(invoice);

    let lastResult: PublishResult | null = null;

    for (const credential of credentials) {
      const responseText = await this.callSoapService({
        serviceUrl: settings.publishServiceUrl,
        soapAction: 'http://tempuri.org/AdjustReplaceInvWithToken',
        operation: 'AdjustReplaceInvWithToken',
        operationXml: `
      <Account>${this.escapeXml(credential.account)}</Account>
      <ACpass>${this.escapeXml(credential.acpass)}</ACpass>
      <xmlInvData>${this.escapeXml(xmlInvData)}</xmlInvData>
      <username>${this.escapeXml(credential.username)}</username>
      <password>${this.escapeXml(credential.password)}</password>
      <type>1</type>
      <pattern>${this.escapeXml(settings.mauSoHoaDon)}</pattern>
      <serial>${this.escapeXml(settings.kyHieuHoaDon)}</serial>`,
      });

      lastResult = this.parseSoapResult(responseText, 'AdjustReplaceInvWithTokenResult');
      if (lastResult.success) {
        break;
      }

      if (lastResult.errorCode !== 1 || credential.label === 'SWAPPED') {
        break;
      }
    }

    if (!lastResult) {
      throw new BadRequestException('Không nhận được phản hồi thay thế hóa đơn từ VNPT');
    }

    if (!lastResult.success) {
      await this.markPublishFailed(invoice.id, `Thay thế thất bại: ${lastResult.message}`);
      throw new BadRequestException(lastResult.message || 'Thay thế hóa đơn thất bại');
    }

    const issuedAt = new Date();
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        invoiceSerial: lastResult.serial ?? invoice.invoiceSerial,
        invoiceFkey: lastResult.fkey ?? invoice.invoiceFkey,
        invoiceIssuedAt: issuedAt,
        invoicePublishStatus: 'SUCCESS',
        invoicePublishMessage: `Thay thế thành công. ${lastResult.message}`,
      },
    });

    return {
      message: 'Thay thế hóa đơn thành công',
      invoiceId: invoice.id,
      invoiceSerial: lastResult.serial ?? invoice.invoiceSerial,
      invoiceFkey: lastResult.fkey ?? invoice.invoiceFkey,
      invoiceIssuedAt: issuedAt.toISOString(),
      vnptMessage: lastResult.message,
    };
  }

  async downloadInvoice(invoiceId: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceFkey: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Hóa đơn không tồn tại');
    }

    if (!invoice.invoiceFkey) {
      throw new BadRequestException('Hóa đơn chưa có Fkey để tải từ VNPT');
    }

    const settings = await this.loadPublishSettings();
    const credentials = this.getCredentialCandidates(settings);
    const portalServiceUrl = this.resolvePortalServiceUrl(settings);
    const viewed = await this.fetchInvoiceViewByFkeyNoPayFromVnpt(
      invoice.invoiceFkey,
      portalServiceUrl,
      credentials,
    );
    const rawResult = viewed.rawMessage;

    const extracted = this.extractInvoiceDownloadContent(rawResult);
    const normalized = this.normalizeDownloadedInvoiceContent(extracted);

    if (normalized.mimeType === 'text/html') {
      return {
        invoiceId,
        fkey: invoice.invoiceFkey,
        filename: normalized.filename ?? `hoa-don-${invoice.id}.html`,
        mimeType: normalized.mimeType,
        base64: normalized.base64,
        content: normalized.content,
        rawMessage: rawResult,
      };
    }

    const linkView = await this.fetchLinkInvViewFkeyFromVnpt(
      invoice.invoiceFkey,
      portalServiceUrl,
      credentials,
    );

    if (!linkView.url) {
      throw new BadRequestException(
        'VNPT chưa trả dữ liệu HTML/link view hợp lệ. Vui lòng kiểm tra fkey/tài khoản WS hoặc cấu hình PORTAL_SERVICE_ADDRESS_ID.',
      );
    }

    const redirectHtml = `<html><head><meta charset="utf-8"><title>Đang mở hóa đơn VNPT</title><meta http-equiv="refresh" content="0;url=${this.escapeHtmlAttr(linkView.url)}" /></head><body><p>Đang mở hóa đơn VNPT...</p><p>Nếu không tự chuyển trang, bấm vào <a href="${this.escapeHtmlAttr(linkView.url)}" target="_blank" rel="noopener noreferrer">đây</a>.</p><script>window.location.replace(${JSON.stringify(linkView.url)});</script></body></html>`;

    return {
      invoiceId,
      fkey: invoice.invoiceFkey,
      filename: `hoa-don-${invoice.id}.html`,
      mimeType: 'text/html',
      base64: false,
      content: redirectHtml,
      rawMessage: linkView.rawMessage || rawResult,
    };
  }

  private async fetchInvoiceViewByFkeyNoPayFromVnpt(
    fkey: string,
    serviceUrl: string,
    credentials: PublishCredential[],
  ) {
    let rawResult = '';
    let lastSoapActionError = '';

    const operationCandidates = [
      {
        soapAction: 'http://tempuri.org/getInvViewFkeyNoPay',
        operation: 'getInvViewFkeyNoPay',
        resultTags: ['getInvViewFkeyNoPayResult', 'GetInvViewFkeyNoPayResult'],
        soapVersion: '1.1' as const,
        omitSoapActionHeader: false,
      },
      {
        soapAction: 'http://tempuri.org/GetInvViewFkeyNoPay',
        operation: 'GetInvViewFkeyNoPay',
        resultTags: ['GetInvViewFkeyNoPayResult', 'getInvViewFkeyNoPayResult'],
        soapVersion: '1.1' as const,
        omitSoapActionHeader: false,
      },
      {
        soapAction: '"http://tempuri.org/GetInvViewFkeyNoPay"',
        operation: 'GetInvViewFkeyNoPay',
        resultTags: ['GetInvViewFkeyNoPayResult', 'getInvViewFkeyNoPayResult'],
        soapVersion: '1.1' as const,
        omitSoapActionHeader: false,
      },
      {
        soapAction: '"http://tempuri.org/getInvViewFkeyNoPay"',
        operation: 'getInvViewFkeyNoPay',
        resultTags: ['getInvViewFkeyNoPayResult', 'GetInvViewFkeyNoPayResult'],
        soapVersion: '1.1' as const,
        omitSoapActionHeader: false,
      },
      {
        soapAction: 'GetInvViewFkeyNoPay',
        operation: 'GetInvViewFkeyNoPay',
        resultTags: ['GetInvViewFkeyNoPayResult', 'getInvViewFkeyNoPayResult'],
        soapVersion: '1.1' as const,
        omitSoapActionHeader: false,
      },
      {
        soapAction: 'getInvViewFkeyNoPay',
        operation: 'getInvViewFkeyNoPay',
        resultTags: ['getInvViewFkeyNoPayResult', 'GetInvViewFkeyNoPayResult'],
        soapVersion: '1.1' as const,
        omitSoapActionHeader: false,
      },
      {
        soapAction: '',
        operation: 'GetInvViewFkeyNoPay',
        resultTags: ['GetInvViewFkeyNoPayResult', 'getInvViewFkeyNoPayResult'],
        soapVersion: '1.1' as const,
        omitSoapActionHeader: true,
      },
      {
        soapAction: 'http://tempuri.org/GetInvViewFkeyNoPay',
        operation: 'GetInvViewFkeyNoPay',
        resultTags: ['GetInvViewFkeyNoPayResult', 'getInvViewFkeyNoPayResult'],
        soapVersion: '1.2' as const,
        omitSoapActionHeader: true,
      },
      {
        soapAction: 'http://tempuri.org/getInvViewFkeyNoPay',
        operation: 'getInvViewFkeyNoPay',
        resultTags: ['getInvViewFkeyNoPayResult', 'GetInvViewFkeyNoPayResult'],
        soapVersion: '1.2' as const,
        omitSoapActionHeader: true,
      },
    ];

    for (const credential of credentials) {
      for (const operation of operationCandidates) {
        let responseText = '';
        try {
          responseText = await this.callSoapService({
            serviceUrl,
            soapAction: operation.soapAction,
            operation: operation.operation,
            soapVersion: operation.soapVersion,
            omitSoapActionHeader: operation.omitSoapActionHeader,
            operationXml: `
      <fkey>${this.escapeXml(fkey)}</fkey>
      <userName>${this.escapeXml(credential.username)}</userName>
      <userPass>${this.escapeXml(credential.password)}</userPass>`,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const unsupportedSoapAction =
            /did not recognize the value of HTTP Header SOAPAction/i.test(message) ||
            /SOAPAction/i.test(message) ||
            /without a valid action parameter/i.test(message) ||
            /please supply a valid soap action/i.test(message) ||
            /valid soap action/i.test(message);

          if (unsupportedSoapAction) {
            lastSoapActionError = message;
            continue;
          }

          throw error;
        }

        const extracted = this.extractSoapResultValue(responseText, operation.resultTags);
        rawResult = this.decodeXmlAndMaybeBase64(extracted || '').trim();
        if (!rawResult) {
          continue;
        }

        const errorCode = this.extractErrorCode(rawResult);
        if (errorCode === 1 && credential.label !== 'SWAPPED') {
          continue;
        }

        if (errorCode !== null) {
          throw new BadRequestException(this.humanizeVnptMessage(rawResult));
        }

        break;
      }

      if (rawResult) {
        break;
      }
    }

    if (!rawResult) {
      if (lastSoapActionError) {
        throw new BadRequestException(
          `VNPT không nhận SOAPAction của getInvViewFkeyNoPay. Chi tiết: ${lastSoapActionError}`,
        );
      }

      throw new BadRequestException('VNPT không trả dữ liệu xem hóa đơn');
    }

    return { rawMessage: rawResult };
  }

  private async fetchLinkInvViewFkeyFromVnpt(
    fkey: string,
    serviceUrl: string,
    credentials: PublishCredential[],
  ) {
    let rawResult = '';

    const operationCandidates = [
      {
        soapAction: 'http://tempuri.org/GetLinkInvViewFkey',
        operation: 'GetLinkInvViewFkey',
        resultTags: ['GetLinkInvViewFkeyResult'],
        soapVersion: '1.1' as const,
      },
      {
        soapAction: 'http://tempuri.org/GetLinkInvViewFkey',
        operation: 'GetLinkInvViewFkey',
        resultTags: ['GetLinkInvViewFkeyResult'],
        soapVersion: '1.2' as const,
      },
    ];

    for (const credential of credentials) {
      for (const operation of operationCandidates) {
        try {
          const responseText = await this.callSoapService({
            serviceUrl,
            soapAction: operation.soapAction,
            operation: operation.operation,
            soapVersion: operation.soapVersion,
            operationXml: `
      <fkey>${this.escapeXml(fkey)}</fkey>
      <userName>${this.escapeXml(credential.username)}</userName>
      <userPass>${this.escapeXml(credential.password)}</userPass>`,
          });

          const extracted = this.extractSoapResultValue(responseText, operation.resultTags);
          rawResult = this.decodeXmlAndMaybeBase64(extracted || '').trim();
          if (!rawResult) {
            continue;
          }

          const url = this.extractUrl(rawResult);
          if (url) {
            return { url, rawMessage: rawResult };
          }

          const errorCode = this.extractErrorCode(rawResult);
          if (errorCode !== null) {
            if (errorCode === 1 && credential.label !== 'SWAPPED') {
              continue;
            }
            throw new BadRequestException(this.humanizeVnptMessage(rawResult));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const unsupportedSoapAction =
            /did not recognize the value of HTTP Header SOAPAction/i.test(message) ||
            /SOAPAction/i.test(message) ||
            /without a valid action parameter/i.test(message) ||
            /please supply a valid soap action/i.test(message) ||
            /valid soap action/i.test(message);

          if (unsupportedSoapAction) {
            continue;
          }

          throw error;
        }
      }
    }

    return { url: '', rawMessage: rawResult };
  }

  private async fetchInvoiceByFkeyFromVnpt(
    fkey: string,
    settings: PublishSettings,
    credentials: PublishCredential[],
  ) {
    let rawResult = '';

    for (const credential of credentials) {
      const responseText = await this.callSoapService({
        serviceUrl: settings.publishServiceUrl,
        soapAction: 'http://tempuri.org/GetInvDataByFkey',
        operation: 'GetInvDataByFkey',
        operationXml: `
      <fkey>${this.escapeXml(fkey)}</fkey>
      <userName>${this.escapeXml(credential.username)}</userName>
      <userPass>${this.escapeXml(credential.password)}</userPass>
      <account>${this.escapeXml(credential.account)}</account>
      <accPass>${this.escapeXml(credential.acpass)}</accPass>
      <pattern>${this.escapeXml(settings.mauSoHoaDon)}</pattern>`,
      });

      const parsed = this.parseSoapResult(responseText, 'GetInvDataByFkeyResult');
      rawResult = parsed.message;
      if (parsed.success || !this.isAuthError(parsed.errorCode) || credential.label === 'SWAPPED') {
        break;
      }
    }

    if (!rawResult) {
      throw new BadRequestException('VNPT không trả dữ liệu hóa đơn');
    }

    return { rawMessage: rawResult };
  }

  private async markPublishFailed(invoiceId: number, message: string) {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        invoicePublishStatus: 'FAILED',
        invoicePublishMessage: message,
      },
    });
  }

  private async loadPublishSettings(): Promise<PublishSettings> {
    const keys = [
      'PUBLISH_SERVICE_ADDRESS_ID',
      'PORTAL_SERVICE_ADDRESS_ID',
      'WS_USER_ID',
      'WS_PASSWORD_ID',
      'C_USER_ID',
      'C_PASSWORD_ID',
      'Mẫu số hóa đơn',
      'Ký hiệu hóa đơn',
      'Tên đơn vị',
      'Mã số thuế',
      'Địa chỉ',
      'Số điện thoại',
    ];

    const params = await this.prisma.systemParameter.findMany({
      where: {
        tenThamSo: { in: keys },
      },
    });

    const map = new Map(params.map((item) => [item.tenThamSo, item.giaTri?.trim() ?? '']));
    const getRequired = (key: string) => {
      const value = map.get(key);
      if (!value) {
        throw new BadRequestException(`Thiếu tham số hệ thống: ${key}`);
      }

      return value;
    };

    return {
      publishServiceUrl: getRequired('PUBLISH_SERVICE_ADDRESS_ID'),
      portalServiceUrl: map.get('PORTAL_SERVICE_ADDRESS_ID') || '',
      wsUserId: getRequired('WS_USER_ID'),
      wsPasswordId: getRequired('WS_PASSWORD_ID'),
      cUserId: getRequired('C_USER_ID'),
      cPasswordId: getRequired('C_PASSWORD_ID'),
      mauSoHoaDon: getRequired('Mẫu số hóa đơn'),
      kyHieuHoaDon: getRequired('Ký hiệu hóa đơn'),
      tenDonVi: map.get('Tên đơn vị') || '',
      maSoThue: map.get('Mã số thuế') || '',
      diaChi: map.get('Địa chỉ') || '',
      soDienThoai: map.get('Số điện thoại') || '',
    };
  }

  private resolvePortalServiceUrl(settings: PublishSettings) {
    if (settings.portalServiceUrl) {
      return settings.portalServiceUrl;
    }

    try {
      const url = new URL(settings.publishServiceUrl);
      url.pathname = '/portalservice.asmx';
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return settings.publishServiceUrl;
    }
  }

  private getCredentialCandidates(settings: PublishSettings): PublishCredential[] {
    return [
      {
        // Java WSMS gọi ImportAndPublishInv theo mapping: Account=C_USER, username=WS_USER.
        account: settings.cUserId,
        acpass: settings.cPasswordId,
        username: settings.wsUserId,
        password: settings.wsPasswordId,
        label: 'DEFAULT',
      },
      {
        account: settings.wsUserId,
        acpass: settings.wsPasswordId,
        username: settings.cUserId,
        password: settings.cPasswordId,
        label: 'SWAPPED',
      },
    ];
  }

  private buildMergedXmlInvData(
    invoices: Array<{
      id: number;
      kyHoaDon: string;
      tongTien: Prisma.Decimal;
      thue: Prisma.Decimal;
      household: {
        maHoDan: string;
        tenChuHo: string;
        diaChi: string;
        soDienThoai: string;
      };
    }>,
    settings: PublishSettings,
  ) {
    const firstInvoice = invoices[0];
    const sortedPeriods = [...new Set(invoices.map((item) => item.kyHoaDon))].sort((a, b) => a.localeCompare(b));
    const mergedPeriodText = sortedPeriods.join(', ');
    const tongTien = invoices.reduce((sum, item) => sum + Number(item.tongTien), 0);
    const tongThue = invoices.reduce((sum, item) => sum + Number(item.thue), 0);
    const total = tongTien + tongThue;
    const issueDate = this.formatDate(new Date());
    const productName =
      invoices.length > 1
        ? `Dịch vụ thu gom rác các kỳ ${mergedPeriodText}`
        : `Dịch vụ thu gom rác kỳ ${firstInvoice.kyHoaDon}`;
    const fkey = this.buildInvoiceXmlKey(sortedPeriods.join('-'), firstInvoice.id);

    return `<Invoices><Inv><key>${this.escapeXml(fkey)}</key><Invoice><CusCode>${this.escapeXml(firstInvoice.household.maHoDan)}</CusCode><CusName>${this.escapeXml(firstInvoice.household.tenChuHo)}</CusName><CusAddress>${this.escapeXml(firstInvoice.household.diaChi || '')}</CusAddress><CusPhone>${this.escapeXml(firstInvoice.household.soDienThoai || '')}</CusPhone><CusTaxCode></CusTaxCode><Buyer>${this.escapeXml(firstInvoice.household.tenChuHo)}</Buyer><ArisingDate>${issueDate}</ArisingDate><PaymentMethod>TM/CK</PaymentMethod><Products><Product><ProdName>${this.escapeXml(productName)}</ProdName><ProdUnit>Gói</ProdUnit><ProdQuantity>1</ProdQuantity><ProdPrice>${tongTien.toFixed(0)}</ProdPrice><Amount>${tongTien.toFixed(0)}</Amount><VATRate>${this.resolveVatRate(firstInvoice)}</VATRate><VATAmount>${tongThue.toFixed(0)}</VATAmount></Product></Products><Total>${tongTien.toFixed(0)}</Total><VATAmount>${tongThue.toFixed(0)}</VATAmount><Amount>${total.toFixed(0)}</Amount><AmountInWords>${this.escapeXml(this.toAmountInWords(total))}</AmountInWords><ComName>${this.escapeXml(settings.tenDonVi)}</ComName><ComTaxCode>${this.escapeXml(settings.maSoThue)}</ComTaxCode><ComAddress>${this.escapeXml(settings.diaChi)}</ComAddress><ComPhone>${this.escapeXml(settings.soDienThoai)}</ComPhone></Invoice></Inv></Invoices>`;
  }

  private buildReplaceXmlInvData(invoice: {
    id: number;
    kyHoaDon: string;
    tongTien: Prisma.Decimal;
    thue: Prisma.Decimal;
    invoiceFkey: string | null;
    household: {
      maHoDan: string;
      tenChuHo: string;
      diaChi: string;
      soDienThoai: string;
    };
  }) {
    const issueDate = this.formatDate(new Date());
    const total = Number(invoice.tongTien) + Number(invoice.thue);
    const fkey = this.buildInvoiceXmlKey(invoice.kyHoaDon, invoice.id);

    return `<Invoices><Inv><Fkey>${this.escapeXml(invoice.invoiceFkey ?? '')}</Fkey><key>${this.escapeXml(fkey)}</key><Invoice><CusCode>${this.escapeXml(invoice.household.maHoDan)}</CusCode><CusName>${this.escapeXml(invoice.household.tenChuHo)}</CusName><CusAddress>${this.escapeXml(invoice.household.diaChi || '')}</CusAddress><CusPhone>${this.escapeXml(invoice.household.soDienThoai || '')}</CusPhone><Buyer>${this.escapeXml(invoice.household.tenChuHo)}</Buyer><ArisingDate>${issueDate}</ArisingDate><PaymentMethod>TM/CK</PaymentMethod><Products><Product><ProdName>${this.escapeXml(`Thay thế hóa đơn dịch vụ thu gom rác kỳ ${invoice.kyHoaDon}`)}</ProdName><ProdUnit>Tháng</ProdUnit><ProdQuantity>1</ProdQuantity><ProdPrice>${Number(invoice.tongTien).toFixed(0)}</ProdPrice><Amount>${Number(invoice.tongTien).toFixed(0)}</Amount><VATRate>${this.resolveVatRate(invoice)}</VATRate><VATAmount>${Number(invoice.thue).toFixed(0)}</VATAmount></Product></Products><Total>${Number(invoice.tongTien).toFixed(0)}</Total><VATAmount>${Number(invoice.thue).toFixed(0)}</VATAmount><Amount>${total.toFixed(0)}</Amount><AmountInWords>${this.escapeXml(this.toAmountInWords(total))}</AmountInWords></Invoice></Inv></Invoices>`;
  }

  private buildInvoiceXmlKey(kyHoaDon: string, invoiceId: number) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    const normalizedKy = String(kyHoaDon ?? '').replace(/-/g, '');
    return `HDR${normalizedKy}${dd}${mm}${yyyy}${hh}${min}${ss}${invoiceId}`;
  }

  private async callPublishService(
    xmlInvData: string,
    settings: PublishSettings,
    credential: PublishCredential,
  ) {
    return this.callSoapService({
      serviceUrl: settings.publishServiceUrl,
      soapAction: 'http://tempuri.org/ImportAndPublishInv',
      operation: 'ImportAndPublishInv',
      operationXml: `
      <Account>${this.escapeXml(credential.account)}</Account>
      <ACpass>${this.escapeXml(credential.acpass)}</ACpass>
      <xmlInvData>${this.escapeXml(xmlInvData)}</xmlInvData>
      <username>${this.escapeXml(credential.username)}</username>
      <password>${this.escapeXml(credential.password)}</password>
      <pattern>${this.escapeXml(settings.mauSoHoaDon)}</pattern>
      <serial>${this.escapeXml(settings.kyHieuHoaDon)}</serial>
      <convert>0</convert>`,
    });
  }

  private async callSoapService(params: {
    serviceUrl: string;
    soapAction?: string;
    operation: string;
    operationXml: string;
    soapVersion?: '1.1' | '1.2';
    omitSoapActionHeader?: boolean;
  }) {
    const soapVersion = params.soapVersion || '1.1';
    const envelopeNs =
      soapVersion === '1.2'
        ? 'http://www.w3.org/2003/05/soap-envelope'
        : 'http://schemas.xmlsoap.org/soap/envelope/';
    const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="${envelopeNs}">
  <soap:Body>
    <${params.operation} xmlns="http://tempuri.org/">${params.operationXml}
    </${params.operation}>
  </soap:Body>
</soap:Envelope>`;

    const soap12Action = this.formatSoap12Action(params.soapAction);
    const headers: Record<string, string> = {
      'Content-Type':
        soapVersion === '1.2'
          ? `application/soap+xml; charset=utf-8${soap12Action ? `; action=${soap12Action}` : ''}`
          : 'text/xml; charset=utf-8',
    };

    if (soapVersion === '1.1' && !params.omitSoapActionHeader && params.soapAction !== undefined) {
      headers.SOAPAction = params.soapAction;
    }

    const response = await fetch(params.serviceUrl, {
      method: 'POST',
      headers,
      body,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new BadRequestException(`VNPT trả về lỗi HTTP ${response.status}: ${text.slice(0, 500)}`);
    }

    return text;
  }

  private formatSoap12Action(action?: string) {
    const trimmed = (action || '').trim();
    if (!trimmed) {
      return '';
    }

    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed;
    }

    return `"${trimmed}"`;
  }

  private parsePublishResult(soapResponse: string) {
    return this.parseSoapResult(soapResponse, 'ImportAndPublishInvResult');
  }

  private extractSoapResultValue(soapResponse: string, resultTags: string[]) {
    for (const tag of resultTags) {
      const tagPattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const match = soapResponse.match(tagPattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return '';
  }

  private parseSoapResult(soapResponse: string, resultTag: string): PublishResult {
    const extractedValue = this.extractSoapResultValue(soapResponse, [resultTag]);
    if (!extractedValue) {
      return {
        success: false,
        message: 'Không đọc được phản hồi từ VNPT',
        serial: null,
        fkey: null,
        errorCode: null,
      };
    }

    const decoded = this.decodeXmlAndMaybeBase64(extractedValue).trim();
    const normalizedOkPayload = this.extractOkPayload(decoded);
    const pairFromOkPayload = this.extractFirstFkeySeriPair(normalizedOkPayload);
    const errorCode = this.extractErrorCode(decoded);
    const normalized = decoded.toLowerCase();
    const hasError =
      normalized.includes('err') ||
      normalized.includes('error') ||
      normalized.includes('exception') ||
      normalized.includes('fault');

    const fkey = pairFromOkPayload?.fkey || this.extractValue(decoded, [
      /<fkey>([^<]+)<\/fkey>/i,
      /<fKey>([^<]+)<\/fKey>/i,
      /<invToken>([^<]+)<\/invToken>/i,
      /"fkey"\s*:\s*"([^"]+)"/i,
      /"invToken"\s*:\s*"([^"]+)"/i,
      /fkey\|([^|\s]+)/i,
      /fkey\s*[:=]\s*([A-Za-z0-9._\-]+)/i,
    ]);

    const serial = pairFromOkPayload?.seri || this.extractValue(decoded, [
      /<serial>([^<]+)<\/serial>/i,
      /<invNo>([^<]+)<\/invNo>/i,
      /<invoiceNo>([^<]+)<\/invoiceNo>/i,
      /"serial"\s*:\s*"([^"]+)"/i,
      /"invNo"\s*:\s*"([^"]+)"/i,
      /"invoiceNo"\s*:\s*"([^"]+)"/i,
      /invno\|([^|\s]+)/i,
      /serial\s*[:=]\s*([A-Za-z0-9._\-\/]+)/i,
      /invno\s*[:=]\s*([A-Za-z0-9._\-\/]+)/i,
      /so\s*hoa\s*don\s*[:=]\s*([A-Za-z0-9._\-\/]+)/i,
    ]);

    return {
      success: !hasError,
      message:
        this.humanizeVnptMessage(decoded) ||
        (hasError ? 'Phát hành thất bại' : 'Phát hành thành công'),
      serial,
      fkey,
      errorCode,
    };
  }

  private parsePublishLikePayload(raw: string) {
    const normalized = this.decodeXmlAndMaybeBase64(raw || '');
    const okPayload = this.extractOkPayload(normalized);
    const pairFromOkPayload = this.extractFirstFkeySeriPair(okPayload);

    const serial = pairFromOkPayload?.seri || this.extractValue(normalized, [
      /<serial>([^<]+)<\/serial>/i,
      /<invNo>([^<]+)<\/invNo>/i,
      /<invoiceNo>([^<]+)<\/invoiceNo>/i,
      /"serial"\s*:\s*"([^"]+)"/i,
      /"invNo"\s*:\s*"([^"]+)"/i,
      /"invoiceNo"\s*:\s*"([^"]+)"/i,
      /invno\|([^|\s]+)/i,
      /serial\s*[:=]\s*([A-Za-z0-9._\-\/]+)/i,
      /invno\s*[:=]\s*([A-Za-z0-9._\-\/]+)/i,
      /so\s*hoa\s*don\s*[:=]\s*([A-Za-z0-9._\-\/]+)/i,
    ]);

    const fkey = pairFromOkPayload?.fkey || this.extractValue(normalized, [
      /<fkey>([^<]+)<\/fkey>/i,
      /<fKey>([^<]+)<\/fKey>/i,
      /<invToken>([^<]+)<\/invToken>/i,
      /"fkey"\s*:\s*"([^"]+)"/i,
      /"invToken"\s*:\s*"([^"]+)"/i,
      /fkey\|([^|\s]+)/i,
      /fkey\s*[:=]\s*([A-Za-z0-9._\-]+)/i,
    ]);

    return { serial, fkey };
  }

  private extractOkPayload(message: string) {
    const cleaned = (message || '').trim();
    if (!/^OK[:\-]/i.test(cleaned)) {
      return cleaned;
    }

    const idx = cleaned.indexOf('-');
    if (idx < 0 || idx >= cleaned.length - 1) {
      return cleaned;
    }

    return cleaned.slice(idx + 1).trim();
  }

  private extractFirstFkeySeriPair(payload: string) {
    // Theo Java WSMS: kết quả thành công thường là fkey_seri hoặc nhiều phần tử ngăn cách dấu phẩy.
    const firstToken = (payload || '').split(',')[0]?.trim();
    if (!firstToken) {
      return null;
    }

    const pair = firstToken.match(/^([^_\s]+)_([0-9]+)$/);
    if (!pair) {
      return null;
    }

    return {
      fkey: pair[1],
      seri: pair[2].padStart(7, '0'),
    };
  }

  private isAuthError(errorCode: number | null) {
    return errorCode === 1;
  }

  private extractErrorCode(content: string) {
    const match = content.match(/ERR\s*:\s*(\d+)/i);
    if (!match?.[1]) {
      return null;
    }

    return Number(match[1]);
  }

  private humanizeVnptMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed) {
      return '';
    }

    const errorCode = this.extractErrorCode(trimmed);
    if (errorCode === 1) {
      return 'ERR:1 - Sai thông tin xác thực VNPT hoặc mapping Account/username chưa đúng. Vui lòng kiểm tra C_USER_ID/C_PASSWORD_ID và WS_USER_ID/WS_PASSWORD_ID.';
    }

    if (errorCode === 6) {
      return 'ERR:6 - Chuỗi Fkey không chính xác.';
    }

    if (errorCode === 7) {
      return 'ERR:7 - Công ty không tồn tại trên hệ thống VNPT.';
    }

    return trimmed;
  }

  private extractInvoiceDownloadContent(rawMessage: string) {
    const cleaned = this.decodeXml(rawMessage).trim();
    const cdata = cleaned.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
    const value = (cdata?.[1] || cleaned).trim();
    return value;
  }

  private normalizeDownloadedInvoiceContent(content: string) {
    const value = (content || '').trim();
    if (!value) {
      return {
        content: '',
        base64: false,
        mimeType: 'text/html',
        filename: null as string | null,
      };
    }

    if (/<html[\s>]|<!doctype html/i.test(value)) {
      return {
        content: value,
        base64: false,
        mimeType: 'text/html',
        filename: null as string | null,
      };
    }

    if (this.looksLikePdfBase64(value)) {
      return {
        content: value.replace(/\s+/g, ''),
        base64: true,
        mimeType: 'application/pdf',
        filename: null as string | null,
      };
    }

    const compact = value.replace(/\s+/g, '');
    if (!this.looksLikeBase64(compact)) {
      return {
        content: value,
        base64: false,
        mimeType: 'application/xml',
        filename: null as string | null,
      };
    }

    try {
      const bytes = Buffer.from(compact, 'base64');
      if (!bytes.length) {
        throw new Error('empty-base64');
      }

      if (
        bytes.length >= 4 &&
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46
      ) {
        return {
          content: compact,
          base64: true,
          mimeType: 'application/pdf',
          filename: null as string | null,
        };
      }

      if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      ) {
        return {
          content: compact,
          base64: true,
          mimeType: 'image/png',
          filename: null as string | null,
        };
      }

      if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return {
          content: compact,
          base64: true,
          mimeType: 'image/jpeg',
          filename: null as string | null,
        };
      }

      const utf8 = bytes.toString('utf8').trim();
      if (/<html[\s>]|<!doctype html/i.test(utf8)) {
        return {
          content: utf8,
          base64: false,
          mimeType: 'text/html',
          filename: null as string | null,
        };
      }

      if (utf8.startsWith('<') || utf8.startsWith('<?xml')) {
        return {
          content: utf8,
          base64: false,
          mimeType: 'application/xml',
          filename: null as string | null,
        };
      }
    } catch {
      // fall through
    }

    return {
      content: value,
      base64: false,
      mimeType: 'application/xml',
      filename: null as string | null,
    };
  }

  private looksLikePdfBase64(content: string) {
    const compact = content.replace(/\s+/g, '');
    return compact.startsWith('JVBERi0');
  }

  private looksLikeBase64(content: string) {
    if (!content || content.length < 16 || content.length % 4 !== 0) {
      return false;
    }

    return /^[A-Za-z0-9+/=]+$/.test(content);
  }

  private extractValue(content: string, patterns: RegExp[]) {
    for (const pattern of patterns) {
      const matched = content.match(pattern);
      if (matched?.[1]) {
        return matched[1].trim();
      }
    }

    return null;
  }

  private extractUrl(content: string) {
    const matched = content.match(/https?:\/\/[^\s"'<>]+/i);
    return matched?.[0] || '';
  }

  private decodeXml(content: string) {
    return content
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }

  private decodeXmlAndMaybeBase64(content: string) {
    const decodedXml = this.decodeXml(content || '').trim();
    const compact = decodedXml.replace(/\s+/g, '');
    if (!this.looksLikeBase64(compact)) {
      return decodedXml;
    }

    try {
      const utf8 = Buffer.from(compact, 'base64').toString('utf8').trim();
      if (!utf8) {
        return decodedXml;
      }

      if (
        utf8.startsWith('<') ||
        utf8.startsWith('{') ||
        /^OK[:\-]/i.test(utf8) ||
        /ERR\s*:/i.test(utf8)
      ) {
        return utf8;
      }
    } catch {
      return decodedXml;
    }

    return decodedXml;
  }

  private escapeXml(input: string) {
    return String(input ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private escapeHtmlAttr(input: string) {
    return String(input ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private formatDate(date: Date) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  private resolveVatRate(invoice: { tongTien: Prisma.Decimal; thue: Prisma.Decimal }) {
    const tongTien = Number(invoice.tongTien);
    const thue = Number(invoice.thue);
    if (!tongTien || tongTien <= 0 || thue <= 0) {
      return '0';
    }

    return String(Math.round((thue / tongTien) * 100));
  }

  private toAmountInWords(amount: number) {
    return `Số tiền ${Math.round(amount).toLocaleString('vi-VN')} đồng`;
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.invoice.update({
      where: { id },
      data: { isActive: false },
    });
    return { id };
  }

  async restore(id: number) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new NotFoundException(`Invoice with id ${id} not found`);
    }

    await this.prisma.invoice.update({
      where: { id },
      data: { isActive: true },
    });

    return { id };
  }
}