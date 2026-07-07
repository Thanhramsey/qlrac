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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { JwtPayload } from '../auth/types/jwt-payload.type';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT', 'STAFF')
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
      trangThaiThanhToan,
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
  @Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT', 'STAFF')
  getDetailReportByPeriod(
    @Req() req: Request & { user?: JwtPayload },
    @Query('kyHoaDon') kyHoaDon?: string,
    @Query('kyHoaDons') kyHoaDons?: string,
    @Query('collectorId') collectorId?: string,
    @Query('routeId') routeId?: string,
    @Query('routeIds') routeIds?: string,
    @Query('trangThaiThanhToan') trangThaiThanhToan?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const user = req.user;
    const finalCollectorId =
      user?.role === 'STAFF'
        ? user.sub
        : collectorId
          ? Number(collectorId)
          : undefined;

    return this.invoicesService.getDetailReportByPeriod({
      kyHoaDon,
      kyHoaDons,
      collectorId: finalCollectorId,
      routeId: routeId ? Number(routeId) : undefined,
      routeIds,
      trangThaiThanhToan,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get('reports/detail-by-period-range')
  @Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT', 'STAFF')
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
  @Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT', 'STAFF')
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
  @Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT', 'STAFF')
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
  @Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT')
  generateFromPeriod(@Param('maKy') maKy: string) {
    return this.invoicesService.generateForPeriod(maKy);
  }

  @Post('publish')
  @Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT', 'STAFF')
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
  @Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT', 'STAFF')
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
  @Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT')
  @HttpCode(HttpStatus.OK)
  replaceInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.replaceInvoice(id);
  }

  @Get(':id/download-vnpt')
  @Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT', 'STAFF')
  downloadInvoiceVnpt(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.downloadInvoice(id);
  }

  @Post('collect')
  @Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT', 'STAFF')
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
  @Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT')
  create(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.create(createInvoiceDto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(id, updateInvoiceDto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT', 'STAFF')
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
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.remove(id);
  }
}