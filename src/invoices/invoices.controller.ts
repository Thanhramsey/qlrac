import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { InvoicePaymentStatus } from '@prisma/client';
import { APP_PERMISSIONS } from '../auth/constants/app-permissions.constant';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { JwtPayload } from '../auth/types/jwt-payload.type';

@Controller('invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(APP_PERMISSIONS.INVOICES_READ)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('mobile/filters')
  getMobileFilters(@Req() req: Request & { user?: JwtPayload }) {
    return this.invoicesService.getMobileCollectionFilters(req.user);
  }

  @Get('mobile/households')
  getMobileHouseholds(
    @Req() req: Request & { user?: JwtPayload },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('kyHoaDons') kyHoaDons?: string,
    @Query('kyHoaDon') kyHoaDon?: string,
    @Query('tuyenThuRacIds') tuyenThuRacIds?: string,
    @Query('tuyenThuRacId') tuyenThuRacId?: string,
    @Query('serviceCatalogIds') serviceCatalogIds?: string,
    @Query('serviceCatalogId') serviceCatalogId?: string,
    @Query('trangThaiThanhToan') trangThaiThanhToan?: string,
    @Query('keyword') keyword?: string,
  ) {
    const parseNumberList = (raw?: string) =>
      (raw ?? '')
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isInteger(item) && item > 0);

    const parseStringList = (raw?: string) =>
      (raw ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

    const kyHoaDonList = parseStringList(kyHoaDons || kyHoaDon);
    const routeIdList = parseNumberList(tuyenThuRacIds || tuyenThuRacId);
    const serviceIdList = parseNumberList(serviceCatalogIds || serviceCatalogId);

    return this.invoicesService.getMobileCollectionHouseholds(req.user, {
      page: Number(page),
      limit: Number(limit),
      kyHoaDons: kyHoaDonList,
      tuyenThuRacIds: routeIdList,
      serviceCatalogIds: serviceIdList,
      trangThaiThanhToan: (trangThaiThanhToan?.trim() as any) || undefined,
      keyword,
    });
  }

  @Get('mobile/unpaid-count')
  getMobileUnpaidCount(
    @Req() req: Request & { user?: JwtPayload },
    @Query('kyHoaDons') kyHoaDons?: string,
    @Query('kyHoaDon') kyHoaDon?: string,
    @Query('tuyenThuRacIds') tuyenThuRacIds?: string,
    @Query('tuyenThuRacId') tuyenThuRacId?: string,
    @Query('serviceCatalogIds') serviceCatalogIds?: string,
    @Query('serviceCatalogId') serviceCatalogId?: string,
    @Query('keyword') keyword?: string,
  ) {
    const parseNumberList = (raw?: string) =>
      (raw ?? '')
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isInteger(item) && item > 0);

    const parseStringList = (raw?: string) =>
      (raw ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

    const kyHoaDonList = parseStringList(kyHoaDons || kyHoaDon);
    const routeIdList = parseNumberList(tuyenThuRacIds || tuyenThuRacId);
    const serviceIdList = parseNumberList(serviceCatalogIds || serviceCatalogId);

    return this.invoicesService.getMobileUnpaidHouseholdCount(req.user, {
      kyHoaDons: kyHoaDonList,
      tuyenThuRacIds: routeIdList,
      serviceCatalogIds: serviceIdList,
      keyword,
    });
  }

  @Get('debt-summary')
  getDebtSummary(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('routeId') routeId?: string,
    @Query('minDebt') minDebt?: string,
    @Query('minOverduePeriods') minOverduePeriods?: string,
  ) {
    return this.invoicesService.getDebtSummary({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      routeId: routeId ? Number(routeId) : undefined,
      minDebt: minDebt ? Number(minDebt) : undefined,
      minOverduePeriods: minOverduePeriods ? Number(minOverduePeriods) : undefined,
    });
  }

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('kyHoaDon') kyHoaDon?: string,
    @Query('tenChuHo') tenChuHo?: string,
    @Query('diaChi') diaChi?: string,
    @Query('tuyenThuRacId') tuyenThuRacId?: string,
    @Query('serviceCatalogId') serviceCatalogId?: string,
    @Query('trangThaiThanhToan') trangThaiThanhToan?: 'UNPAID' | 'PAID' | 'OVERDUE',
  ) {
    return this.invoicesService.findAll(Number(page), Number(limit), {
      kyHoaDon,
      tenChuHo,
      diaChi,
      tuyenThuRacId: tuyenThuRacId ? Number(tuyenThuRacId) : undefined,
      serviceCatalogId: serviceCatalogId ? Number(serviceCatalogId) : undefined,
      trangThaiThanhToan,
    });
  }

  @Get('household/:householdId/history')
  getHouseholdHistory(@Param('householdId', ParseIntPipe) householdId: number) {
    return this.invoicesService.getHouseholdHistory(householdId);
  }

  @Get('receipt')
  getReceiptPayload(@Query('invoiceIds') invoiceIds?: string) {
    const ids = (invoiceIds ?? '')
      .split(',')
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0);

    return this.invoicesService.getReceiptPayload(ids);
  }

  @Get('reports/detail-by-period')
  @RequirePermissions(APP_PERMISSIONS.INVOICES_REPORT)
  getDetailReportByPeriod(
    @Query('kyHoaDon') kyHoaDon?: string,
    @Query('kyHoaDons') kyHoaDons?: string,
    @Query('collectorId') collectorId?: string,
    @Query('routeId') routeId?: string,
    @Query('routeIds') routeIds?: string,
    @Query('trangThaiThanhToan') trangThaiThanhToan?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const rawKy = (kyHoaDons || kyHoaDon || '').trim();
    const parsedKyList = rawKy
      ? rawKy.split(',').map((item) => item.trim()).filter(Boolean)
      : [];

    const rawRoutes = (routeIds || routeId || '').trim();
    const parsedRouteList = rawRoutes
      ? rawRoutes
          .split(',')
          .map((item) => Number(item.trim()))
          .filter((id) => Number.isInteger(id) && id > 0)
      : [];

    return this.invoicesService.getDetailReportByPeriod({
      kyHoaDon: kyHoaDon?.trim(),
      kyHoaDons: parsedKyList,
      collectorId: collectorId ? Number(collectorId) : undefined,
      routeId: routeId ? Number(routeId) : undefined,
      routeIds: parsedRouteList,
      trangThaiThanhToan: (trangThaiThanhToan?.trim() as any) || undefined,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get('reports/detail-by-period-range')
  @RequirePermissions(APP_PERMISSIONS.INVOICES_REPORT)
  getDetailReportByPeriodRange(
    @Query('fromKy') fromKy?: string,
    @Query('toKy') toKy?: string,
    @Query('collectorId') collectorId?: string,
    @Query('routeId') routeId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.invoicesService.getDetailReportByPeriodRange({
      fromKy,
      toKy,
      collectorId: collectorId ? Number(collectorId) : undefined,
      routeId: routeId ? Number(routeId) : undefined,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get('reports/detail-by-date')
  @RequirePermissions(APP_PERMISSIONS.INVOICES_REPORT)
  getDetailReportByDate(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('collectorId') collectorId?: string,
    @Query('routeId') routeId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.invoicesService.getDetailReportByDate({
      fromDate,
      toDate,
      collectorId: collectorId ? Number(collectorId) : undefined,
      routeId: routeId ? Number(routeId) : undefined,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get('reports/revenue-summary')
  @RequirePermissions(APP_PERMISSIONS.INVOICES_REPORT)
  getRevenueSummaryReport(
    @Query('kyHoaDon') kyHoaDon?: string,
    @Query('routeId') routeId?: string,
    @Query('serviceCatalogId') serviceCatalogId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.invoicesService.getRevenueSummaryReport({
      kyHoaDon,
      routeId: routeId ? Number(routeId) : undefined,
      serviceCatalogId: serviceCatalogId ? Number(serviceCatalogId) : undefined,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Post('generate-from-period/:maKy')
  @RequirePermissions(APP_PERMISSIONS.INVOICES_MANAGE)
  generateFromPeriod(@Param('maKy') maKy: string) {
    return this.invoicesService.generateForPeriod(maKy);
  }

  @Post('publish')
  @RequirePermissions(APP_PERMISSIONS.INVOICES_PUBLISH)
  @HttpCode(HttpStatus.OK)
  publishInvoices(
    @Req() req: Request & { user?: JwtPayload },
    @Body('invoiceIds') invoiceIdsRaw?: number[] | string,
  ) {
    let parsedIds: number[] = [];

    if (Array.isArray(invoiceIdsRaw)) {
      parsedIds = invoiceIdsRaw
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0);
    } else if (invoiceIdsRaw?.trim()) {
      try {
        const parsed = JSON.parse(invoiceIdsRaw) as unknown;
        if (Array.isArray(parsed)) {
          parsedIds = parsed
            .map((item) => Number(item))
            .filter((item) => Number.isInteger(item) && item > 0);
        }
      } catch {
        parsedIds = invoiceIdsRaw
          .split(',')
          .map((item) => Number(item.trim()))
          .filter((item) => Number.isInteger(item) && item > 0);
      }
    }

    return this.invoicesService.publishInvoices(parsedIds, req.user);
  }

  @Post('sync-metadata')
  @RequirePermissions(APP_PERMISSIONS.INVOICES_MANAGE)
  @HttpCode(HttpStatus.OK)
  syncPublishMetadata(@Body('invoiceIds') invoiceIdsRaw?: number[] | string) {
    let parsedIds: number[] = [];

    if (Array.isArray(invoiceIdsRaw)) {
      parsedIds = invoiceIdsRaw
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0);
    } else if (invoiceIdsRaw?.trim()) {
      try {
        const parsed = JSON.parse(invoiceIdsRaw) as unknown;
        if (Array.isArray(parsed)) {
          parsedIds = parsed
            .map((item) => Number(item))
            .filter((item) => Number.isInteger(item) && item > 0);
        }
      } catch {
        parsedIds = invoiceIdsRaw
          .split(',')
          .map((item) => Number(item.trim()))
          .filter((item) => Number.isInteger(item) && item > 0);
      }
    }

    return this.invoicesService.syncPublishMetadata(parsedIds);
  }

  @Post(':id/replace')
  @RequirePermissions(APP_PERMISSIONS.INVOICES_MANAGE)
  @HttpCode(HttpStatus.OK)
  replaceInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.replaceInvoice(id);
  }

  @Get(':id/download-vnpt')
  @RequirePermissions(APP_PERMISSIONS.INVOICES_PUBLISH)
  downloadInvoiceVnpt(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.downloadInvoice(id);
  }

  @Post('collect')
  @RequirePermissions(APP_PERMISSIONS.INVOICES_COLLECT)
  @UseInterceptors(
    FileInterceptor('receiptImage', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'receipts'),
        filename: (_req, file, cb) => {
          const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `receipt-${suffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  @HttpCode(HttpStatus.OK)
  collectInvoices(
    @Req() req: Request & { user?: JwtPayload },
    @Body('invoiceIds') invoiceIdsRaw?: string | number[],
    @Body('paymentNote') paymentNote?: string,
    @UploadedFile() receiptImage?: Express.Multer.File,
  ) {
    let parsedIds: number[] = [];

    if (Array.isArray(invoiceIdsRaw)) {
      parsedIds = invoiceIdsRaw
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0);
    } else if (invoiceIdsRaw?.trim()) {
      try {
        const parsed = JSON.parse(invoiceIdsRaw) as unknown;
        if (Array.isArray(parsed)) {
          parsedIds = parsed
            .map((item) => Number(item))
            .filter((item) => Number.isInteger(item) && item > 0);
        }
      } catch {
        parsedIds = invoiceIdsRaw
          .split(',')
          .map((item) => Number(item.trim()))
          .filter((item) => Number.isInteger(item) && item > 0);
      }
    }

    const receiptImageUrl = receiptImage ? `/uploads/receipts/${receiptImage.filename}` : undefined;
    return this.invoicesService.collectInvoices(parsedIds, paymentNote, receiptImageUrl, req.user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.findOne(id);
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.INVOICES_MANAGE)
  create(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.create(createInvoiceDto);
  }

  @Patch(':id')
  @RequirePermissions(APP_PERMISSIONS.INVOICES_MANAGE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(id, updateInvoiceDto);
  }

  @Patch(':id/status')
  @RequirePermissions(APP_PERMISSIONS.INVOICES_COLLECT)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('trangThaiThanhToan') trangThaiThanhToan?: 'UNPAID' | 'PAID' | 'OVERDUE',
  ) {
    return this.invoicesService.updateStatus(
      id,
      (trangThaiThanhToan ?? 'UNPAID') as InvoicePaymentStatus,
    );
  }

  @Delete(':id')
  @RequirePermissions(APP_PERMISSIONS.INVOICES_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions(APP_PERMISSIONS.INVOICES_RESTORE)
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.restore(id);
  }
}