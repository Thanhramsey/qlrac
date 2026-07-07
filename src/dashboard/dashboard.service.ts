import { Injectable } from '@nestjs/common';
import { InvoicePaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type TrendBucket = {
  maKy: string;
  tenKy: string;
  totalInvoices: number;
  paidInvoices: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  totalRevenue: number;
  paidRevenue: number;
  needToCollectRevenue: number;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(kyHoaDon?: string | string[]) {
    const selectedKyHoaDons = this.normalizeKyHoaDons(kyHoaDon);
    const invoiceWhere =
      selectedKyHoaDons.length > 0 ? { kyHoaDon: { in: selectedKyHoaDons } } : undefined;

    const [
      totalHouseholds,
      totalRoutes,
      totalUsers,
      totalInvoices,
      paidInvoices,
      publishedInvoices,
      unpaidInvoices,
      overdueInvoices,
      totalRevenueAgg,
      paidRevenueAgg,
      needToCollectAgg,
    ] = await this.prisma.$transaction([
      this.prisma.household.count({ where: { isActive: true } }),
      this.prisma.route.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.invoice.count({ where: invoiceWhere }),
      this.prisma.invoice.count({
        where: {
          ...invoiceWhere,
          trangThaiThanhToan: InvoicePaymentStatus.PAID,
        },
      }),
      this.prisma.invoice.count({
        where: {
          ...invoiceWhere,
          trangThaiThanhToan: InvoicePaymentStatus.PUBLISHED,
        },
      }),
      this.prisma.invoice.count({
        where: {
          ...invoiceWhere,
          trangThaiThanhToan: InvoicePaymentStatus.UNPAID,
        },
      }),
      this.prisma.invoice.count({
        where: {
          ...invoiceWhere,
          trangThaiThanhToan: InvoicePaymentStatus.OVERDUE,
        },
      }),
      this.prisma.invoice.aggregate({ where: invoiceWhere, _sum: { tongTien: true, thue: true } }),
      this.prisma.invoice.aggregate({
        where: {
          ...invoiceWhere,
          trangThaiThanhToan: { in: [InvoicePaymentStatus.PAID, InvoicePaymentStatus.PUBLISHED] },
        },
        _sum: { tongTien: true, thue: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          ...invoiceWhere,
          trangThaiThanhToan: {
            in: [InvoicePaymentStatus.UNPAID, InvoicePaymentStatus.OVERDUE],
          },
        },
        _sum: { tongTien: true, thue: true },
      }),
    ]);

    let periods = await this.prisma.billingPeriod.findMany({
      where: selectedKyHoaDons.length > 0 ? { maKy: { in: selectedKyHoaDons } } : undefined,
      orderBy: { ngayBatDau: 'asc' },
      select: {
        maKy: true,
        tenKy: true,
      },
    });

    if (periods.length === 0) {
      const invoicePeriods = await this.prisma.invoice.groupBy({
        by: ['kyHoaDon'],
        where: invoiceWhere,
        orderBy: { kyHoaDon: 'asc' },
      });

      periods = invoicePeriods.map((item) => ({
        maKy: item.kyHoaDon,
        tenKy: this.toPeriodLabel(item.kyHoaDon),
      }));
    }

    const orderedPeriods = [...periods].sort((a, b) => a.maKy.localeCompare(b.maKy));
    const periodKeys = orderedPeriods.map((item) => item.maKy);

    const groupedByPeriod =
      periodKeys.length > 0
        ? await this.prisma.invoice.groupBy({
            by: ['kyHoaDon', 'trangThaiThanhToan'],
            where: {
              ...invoiceWhere,
              kyHoaDon: { in: periodKeys },
            },
            _count: { _all: true },
            _sum: {
              tongTien: true,
              thue: true,
            },
          })
        : [];

    const trendByPeriod = new Map<string, TrendBucket>(
      orderedPeriods.map((item) => [
        item.maKy,
        {
          maKy: item.maKy,
          tenKy: item.tenKy,
          totalInvoices: 0,
          paidInvoices: 0,
          unpaidInvoices: 0,
          overdueInvoices: 0,
          totalRevenue: 0,
          paidRevenue: 0,
          needToCollectRevenue: 0,
        },
      ]),
    );

    for (const row of groupedByPeriod) {
      const bucket = trendByPeriod.get(row.kyHoaDon);
      if (!bucket) {
        continue;
      }

      const amount = Number(row._sum.tongTien ?? 0) + Number(row._sum.thue ?? 0);
      const count = row._count._all;

      bucket.totalInvoices += count;
      bucket.totalRevenue += amount;

      if (row.trangThaiThanhToan === InvoicePaymentStatus.PAID || row.trangThaiThanhToan === InvoicePaymentStatus.PUBLISHED) {
        bucket.paidInvoices += count;
        bucket.paidRevenue += amount;
      }

      if (row.trangThaiThanhToan === InvoicePaymentStatus.UNPAID) {
        bucket.unpaidInvoices += count;
        bucket.needToCollectRevenue += amount;
      }

      if (row.trangThaiThanhToan === InvoicePaymentStatus.OVERDUE) {
        bucket.overdueInvoices += count;
        bucket.needToCollectRevenue += amount;
      }
    }

    const staffMembers = await this.prisma.user.findMany({
      where: {
        assignedRoutes: { some: {} },
      },
      select: {
        id: true,
        hoVaTen: true,
        taiKhoan: true,
        assignedRoutes: {
          select: {
            id: true,
          },
        },
      },
    });

    const staffProgress = await Promise.all(
      staffMembers.map(async (staff) => {
        const routeIds = staff.assignedRoutes.map((r) => r.id);
        if (routeIds.length === 0) {
          return {
            staffId: staff.id,
            staffName: staff.hoVaTen || staff.taiKhoan,
            paidCount: 0,
            unpaidCount: 0,
            totalCount: 0,
            paidPercentage: 0,
            unpaidPercentage: 0,
          };
        }

        const [paidCount, unpaidCount] = await Promise.all([
          this.prisma.invoice.count({
            where: {
              ...invoiceWhere,
              trangThaiThanhToan: { in: [InvoicePaymentStatus.PAID, InvoicePaymentStatus.PUBLISHED] },
              household: {
                tuyenThuRacId: { in: routeIds },
              },
            },
          }),
          this.prisma.invoice.count({
            where: {
              ...invoiceWhere,
              trangThaiThanhToan: { in: [InvoicePaymentStatus.UNPAID, InvoicePaymentStatus.OVERDUE] },
              household: {
                tuyenThuRacId: { in: routeIds },
              },
            },
          }),
        ]);

        const totalCount = paidCount + unpaidCount;
        const paidPercentage = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;
        const unpaidPercentage = totalCount > 0 ? 100 - paidPercentage : 0;

        return {
          staffId: staff.id,
          staffName: staff.hoVaTen || staff.taiKhoan,
          paidCount,
          unpaidCount,
          totalCount,
          paidPercentage,
          unpaidPercentage,
        };
      }),
    );

    return {
      filter: {
        kyHoaDons: selectedKyHoaDons,
      },
      summary: {
        totalHouseholds,
        totalRoutes,
        totalUsers,
        totalInvoices,
        paidInvoices: paidInvoices + publishedInvoices,
        unpaidInvoices,
        overdueInvoices,
        totalRevenue: Number(totalRevenueAgg._sum.tongTien ?? 0) + Number(totalRevenueAgg._sum.thue ?? 0),
        paidRevenue: Number(paidRevenueAgg._sum.tongTien ?? 0) + Number(paidRevenueAgg._sum.thue ?? 0),
        totalNeedToCollect:
          Number(needToCollectAgg._sum.tongTien ?? 0) + Number(needToCollectAgg._sum.thue ?? 0),
      },
      invoiceStatusChart: [
        { key: 'PAID', label: 'Đã thu (chưa xuất HĐ)', count: paidInvoices },
        { key: 'PUBLISHED', label: 'Đã xuất hóa đơn', count: publishedInvoices },
        { key: 'UNPAID', label: 'Chưa thanh toán', count: unpaidInvoices },
        { key: 'OVERDUE', label: 'Quá hạn', count: overdueInvoices },
      ],
      invoiceTrendChart: orderedPeriods.map((item) => {
        const bucket = trendByPeriod.get(item.maKy);
        return (
          bucket ?? {
            maKy: item.maKy,
            tenKy: item.tenKy,
            totalInvoices: 0,
            paidInvoices: 0,
            unpaidInvoices: 0,
            overdueInvoices: 0,
            totalRevenue: 0,
            paidRevenue: 0,
            needToCollectRevenue: 0,
          }
        );
      }),
      staffProgress,
    };
  }

  private normalizeKyHoaDons(kyHoaDon?: string | string[]) {
    if (Array.isArray(kyHoaDon)) {
      return kyHoaDon.map((item) => item.trim()).filter((item) => item.length > 0);
    }

    if (!kyHoaDon) {
      return [];
    }

    return kyHoaDon
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private toPeriodLabel(maKy: string) {
    const [year, month] = maKy.split('-');
    if (!year || !month) {
      return maKy;
    }
    return `Kỳ ${month}/${year}`;
  }
}
