import {
  Button,
  Card,
  DatePicker,
  Form,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import type { Dayjs } from 'dayjs'
import { FileExcelOutlined, FilePdfOutlined, SearchOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import { apiClient } from '../api/axios.instance'
import type {
  BillingPeriodItem,
  InvoiceDetailByDateReportResponse,
  InvoiceDetailReportResponse,
  InvoiceRevenueSummaryResponse,
  RouteItem,
  ServiceCatalogItem,
  UserListItem,
  UserListResponse,
} from '../types'

;(pdfMake as unknown as { vfs: Record<string, string> }).vfs = (pdfFonts as unknown as { vfs: Record<string, string> }).vfs

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

type PeriodDetailFilter = {
  kyHoaDon?: string
  collectorId?: number
  routeId?: number
}

type PeriodRangeDetailFilter = {
  fromKy?: string
  toKy?: string
  collectorId?: number
  routeId?: number
}

type DateDetailFilter = {
  dateRange?: [Dayjs, Dayjs]
  collectorId?: number
  routeId?: number
}

type RevenueSummaryFilter = {
  kyHoaDon?: string
  routeId?: number
  serviceCatalogId?: number
}

type ReportsPageProps = {
  initialTab?: 'detail-by-period' | 'detail-by-period-range' | 'detail-by-date' | 'revenue-summary'
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return ''
  }

  return new Date(value).toLocaleString('vi-VN')
}

function formatDate(value?: string | null) {
  if (!value) {
    return ''
  }

  return new Date(value).toLocaleDateString('vi-VN')
}

function fileTimestamp() {
  const now = new Date()
  const pad = (val: number) => String(val).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

function vietnameseReportDateLine() {
  const now = new Date()
  return `Gia Lai, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`
}

export function ReportsPage({ initialTab = 'detail-by-period' }: ReportsPageProps) {
  const [billingPeriods, setBillingPeriods] = useState<BillingPeriodItem[]>([])
  const [routes, setRoutes] = useState<RouteItem[]>([])
  const [services, setServices] = useState<ServiceCatalogItem[]>([])
  const [collectors, setCollectors] = useState<UserListItem[]>([])

  const [activeTab, setActiveTab] = useState<'detail-by-period' | 'detail-by-period-range' | 'detail-by-date' | 'revenue-summary'>(initialTab)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const [periodData, setPeriodData] = useState<InvoiceDetailReportResponse['data']>([])
  const [periodSummary, setPeriodSummary] = useState<InvoiceDetailReportResponse['summary'] | null>(null)
  const [periodLoading, setPeriodLoading] = useState(false)

  const [periodRangeData, setPeriodRangeData] = useState<InvoiceDetailReportResponse['data']>([])
  const [periodRangeSummary, setPeriodRangeSummary] = useState<InvoiceDetailReportResponse['summary'] | null>(null)
  const [periodRangeLoading, setPeriodRangeLoading] = useState(false)

  const [dateData, setDateData] = useState<InvoiceDetailByDateReportResponse['data']>([])
  const [dateDailySummary, setDateDailySummary] = useState<InvoiceDetailByDateReportResponse['tongHopTheoNgay']>([])
  const [dateSummary, setDateSummary] = useState<InvoiceDetailByDateReportResponse['summary'] | null>(null)
  const [dateLoading, setDateLoading] = useState(false)

  const [revenueData, setRevenueData] = useState<InvoiceRevenueSummaryResponse['data']>([])
  const [revenueSummary, setRevenueSummary] = useState<InvoiceRevenueSummaryResponse['summary'] | null>(null)
  const [revenueLoading, setRevenueLoading] = useState(false)

  const [periodForm] = Form.useForm<PeriodDetailFilter>()
  const [periodRangeForm] = Form.useForm<PeriodRangeDetailFilter>()
  const [dateForm] = Form.useForm<DateDetailFilter>()
  const [revenueForm] = Form.useForm<RevenueSummaryFilter>()

  const periodOptions = useMemo(
    () =>
      billingPeriods.map((item) => ({
        value: item.maKy,
        label: `${item.tenKy} (${item.maKy})`,
      })),
    [billingPeriods],
  )

  const routeOptions = useMemo(
    () =>
      routes.map((item) => ({
        value: item.id,
        label: `${item.tenTuyen} (${item.maTuyen})`,
      })),
    [routes],
  )

  const serviceOptions = useMemo(
    () =>
      services
        .filter((item) => item.isActive)
        .map((item) => ({
          value: item.id,
          label: `${item.tenDichVu} (${item.maDichVu})`,
        })),
    [services],
  )

  const collectorOptions = useMemo(
    () =>
      collectors
        .filter((item) => item.isActive)
        .map((item) => ({
          value: item.id,
          label: `${item.hoVaTen} (${item.taiKhoan})`,
        })),
    [collectors],
  )

  useEffect(() => {
    void (async () => {
      try {
        const [periodResponse, routeResponse, serviceResponse, usersResponse] = await Promise.all([
          apiClient.get('/billing-periods', { params: { page: 1, limit: 1000 } }),
          apiClient.get('/routes', { params: { page: 1, limit: 1000 } }),
          apiClient.get('/service-catalogs', { params: { page: 1, limit: 1000 } }),
          apiClient.get<UserListResponse>('/users', { params: { page: 1, limit: 1000 } }),
        ])

        setBillingPeriods(periodResponse.data.data ?? [])
        setRoutes(routeResponse.data.data ?? [])
        setServices(serviceResponse.data.data ?? [])
        setCollectors(usersResponse.data.data ?? [])

        const latestPeriod = periodResponse.data.data?.[0]?.maKy
        if (latestPeriod) {
          periodForm.setFieldsValue({ kyHoaDon: latestPeriod })
          periodRangeForm.setFieldsValue({ fromKy: latestPeriod, toKy: latestPeriod })
          revenueForm.setFieldsValue({ kyHoaDon: latestPeriod })
        }
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Không tải được dữ liệu danh mục báo cáo')
      }
    })()
  }, [])

  const searchDetailByPeriod = async () => {
    const values = periodForm.getFieldsValue()
    if (!values.kyHoaDon) {
      message.warning('Vui lòng chọn kỳ hóa đơn')
      return
    }

    setPeriodLoading(true)
    try {
      const response = await apiClient.get<InvoiceDetailReportResponse>('/invoices/reports/detail-by-period', {
        params: {
          kyHoaDon: values.kyHoaDon,
          collectorId: values.collectorId,
          routeId: values.routeId,
          page: 1,
          limit: 500,
        },
      })

      setPeriodData(response.data.data)
      setPeriodSummary(response.data.summary)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không lấy được báo cáo chi tiết theo kỳ')
    } finally {
      setPeriodLoading(false)
    }
  }

  const searchDetailByDate = async () => {
    const values = dateForm.getFieldsValue()
    if (!values.dateRange || values.dateRange.length !== 2) {
      message.warning('Vui lòng chọn khoảng ngày')
      return
    }

    setDateLoading(true)
    try {
      const [from, to] = values.dateRange
      const response = await apiClient.get<InvoiceDetailByDateReportResponse>('/invoices/reports/detail-by-date', {
        params: {
          fromDate: from.format('YYYY-MM-DD'),
          toDate: to.format('YYYY-MM-DD'),
          collectorId: values.collectorId,
          routeId: values.routeId,
          page: 1,
          limit: 500,
        },
      })

      setDateData(response.data.data)
      setDateSummary(response.data.summary)
      setDateDailySummary(response.data.tongHopTheoNgay ?? [])
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không lấy được báo cáo chi tiết theo ngày')
    } finally {
      setDateLoading(false)
    }
  }

  const searchDetailByPeriodRange = async () => {
    const values = periodRangeForm.getFieldsValue()
    if (!values.fromKy || !values.toKy) {
      message.warning('Vui lòng chọn Từ kỳ và Đến kỳ')
      return
    }

    setPeriodRangeLoading(true)
    try {
      const response = await apiClient.get<InvoiceDetailReportResponse>('/invoices/reports/detail-by-period-range', {
        params: {
          fromKy: values.fromKy,
          toKy: values.toKy,
          collectorId: values.collectorId,
          routeId: values.routeId,
          page: 1,
          limit: 500,
        },
      })

      setPeriodRangeData(response.data.data)
      setPeriodRangeSummary(response.data.summary)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không lấy được báo cáo từ kỳ đến kỳ')
    } finally {
      setPeriodRangeLoading(false)
    }
  }

  const searchRevenueSummary = async () => {
    const values = revenueForm.getFieldsValue()
    if (!values.kyHoaDon) {
      message.warning('Vui lòng chọn kỳ hóa đơn')
      return
    }

    setRevenueLoading(true)
    try {
      const response = await apiClient.get<InvoiceRevenueSummaryResponse>('/invoices/reports/revenue-summary', {
        params: {
          kyHoaDon: values.kyHoaDon,
          routeId: values.routeId,
          serviceCatalogId: values.serviceCatalogId,
          page: 1,
          limit: 1000,
        },
      })

      setRevenueData(response.data.data)
      setRevenueSummary(response.data.summary)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không lấy được báo cáo tổng hợp doanh số')
    } finally {
      setRevenueLoading(false)
    }
  }

  const exportSheetToExcel = async (
    reportTitle: string,
    sheetName: string,
    headers: string[],
    body: Array<Array<string | number>>,
    totalRow: Array<string | number>,
    filename: string,
  ) => {
    if (!body.length) {
      message.warning('Không có dữ liệu để xuất Excel')
      return
    }

    const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
      import('exceljs'),
      import('file-saver'),
    ])

    const totalColumns = Math.max(headers.length, 8)
    const leftEnd = Math.max(1, Math.floor(totalColumns / 2))
    const rightStart = leftEnd + 1

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(sheetName)

    for (let col = 1; col <= totalColumns; col += 1) {
      worksheet.getColumn(col).width = 18
    }

    worksheet.mergeCells(1, 1, 1, leftEnd)
    worksheet.getCell(1, 1).value = 'BAN QUẢN LÝ PHƯỜNG AN KHÊ - GIA LAI'
    worksheet.getCell(1, 1).font = { bold: true, size: 12 }
    worksheet.getCell(1, 1).alignment = { horizontal: 'left', vertical: 'middle' }

    worksheet.mergeCells(1, rightStart, 1, totalColumns)
    worksheet.getCell(1, rightStart).value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'
    worksheet.getCell(1, rightStart).font = { bold: true, size: 12 }
    worksheet.getCell(1, rightStart).alignment = { horizontal: 'center', vertical: 'middle' }

    worksheet.mergeCells(2, rightStart, 2, totalColumns)
    worksheet.getCell(2, rightStart).value = 'Độc lập - Tự do - Hạnh phúc'
    worksheet.getCell(2, rightStart).font = { bold: true, size: 11, italic: true }
    worksheet.getCell(2, rightStart).alignment = { horizontal: 'center', vertical: 'middle' }

    worksheet.mergeCells(3, rightStart, 3, totalColumns)
    worksheet.getCell(3, rightStart).value = vietnameseReportDateLine()
    worksheet.getCell(3, rightStart).font = { size: 11 }
    worksheet.getCell(3, rightStart).alignment = { horizontal: 'center', vertical: 'middle' }

    worksheet.mergeCells(4, 1, 4, totalColumns)
    worksheet.getCell(4, 1).value = reportTitle.toUpperCase()
    worksheet.getCell(4, 1).font = { bold: true, size: 14 }
    worksheet.getCell(4, 1).alignment = { horizontal: 'center', vertical: 'middle' }

    const headerRowIndex = 6
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(headerRowIndex, index + 1)
      cell.value = header
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0A5BD8' },
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
        bottom: { style: 'thin' },
      }
    })

    let currentRow = headerRowIndex + 1
    for (const row of body) {
      for (let col = 0; col < headers.length; col += 1) {
        const cell = worksheet.getCell(currentRow, col + 1)
        cell.value = row[col] ?? ''
        cell.alignment = {
          horizontal: typeof row[col] === 'number' ? 'right' : 'left',
          vertical: 'middle',
          wrapText: true,
        }
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
          bottom: { style: 'thin' },
        }
      }
      currentRow += 1
    }

    for (let col = 0; col < headers.length; col += 1) {
      const cell = worksheet.getCell(currentRow, col + 1)
      cell.value = totalRow[col] ?? ''
      cell.font = { bold: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEBF5FF' },
      }
      cell.alignment = {
        horizontal: col === 0 ? 'left' : typeof totalRow[col] === 'number' ? 'right' : 'left',
        vertical: 'middle',
        wrapText: true,
      }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
        bottom: { style: 'thin' },
      }
    }

    const signatureTitleRow = currentRow + 3
    const signatureSubRow = currentRow + 4
    const signLeftCol = Math.max(2, Math.floor(totalColumns / 4))
    const signRightCol = Math.max(signLeftCol + 2, Math.floor((totalColumns * 3) / 4))

    worksheet.getCell(signatureTitleRow, signLeftCol).value = 'Người lập bảng'
    worksheet.getCell(signatureTitleRow, signLeftCol).font = { bold: true, size: 11 }
    worksheet.getCell(signatureTitleRow, signLeftCol).alignment = { horizontal: 'center' }

    worksheet.getCell(signatureTitleRow, signRightCol).value = 'Giám đốc'
    worksheet.getCell(signatureTitleRow, signRightCol).font = { bold: true, size: 11 }
    worksheet.getCell(signatureTitleRow, signRightCol).alignment = { horizontal: 'center' }

    worksheet.getCell(signatureSubRow, signLeftCol).value = '(Ký, ghi rõ họ tên)'
    worksheet.getCell(signatureSubRow, signLeftCol).alignment = { horizontal: 'center' }

    worksheet.getCell(signatureSubRow, signRightCol).value = '(Ký, ghi rõ họ tên)'
    worksheet.getCell(signatureSubRow, signRightCol).alignment = { horizontal: 'center' }

    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), filename)
  }

  const exportSimplePdf = (
    title: string,
    headers: string[],
    body: Array<Array<string | number>>,
    totalRow: Array<string | number>,
    filename: string,
  ) => {
    if (!body.length) {
      message.warning('Không có dữ liệu để xuất PDF')
      return
    }

    const tableBody = [
      headers.map((item) => ({ text: item, style: 'tableHeader' })),
      ...body.map((row) => row.map((cell) => ({ text: String(cell) }))),
      totalRow.map((cell) => ({ text: String(cell), style: 'tableTotal' })),
    ]

    const docDefinition = {
      pageOrientation: 'landscape' as const,
      pageSize: 'A4' as const,
      pageMargins: [24, 24, 24, 24] as [number, number, number, number],
      content: [
        {
          columns: [
            {
              width: '50%',
              stack: [
                { text: 'BAN QUẢN LÝ PHƯỜNG AN KHÊ - GIA LAI', style: 'unitName' },
              ],
            },
            {
              width: '50%',
              alignment: 'center' as const,
              stack: [
                { text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', style: 'nationalTitle' },
                { text: 'Độc lập - Tự do - Hạnh phúc', style: 'motto' },
                { text: vietnameseReportDateLine(), style: 'dateLine' },
              ],
            },
          ],
        },
        {
          text: title.toUpperCase(),
          style: 'reportTitle',
          alignment: 'center' as const,
          margin: [0, 14, 0, 10] as [number, number, number, number],
        },
        {
          table: {
            headerRows: 1,
            body: tableBody,
          },
          layout: {
            fillColor: (rowIndex: number) => {
              if (rowIndex === 0) {
                return '#0a5bd8'
              }
              if (rowIndex === tableBody.length - 1) {
                return '#ebf5ff'
              }
              return rowIndex % 2 === 0 ? '#fcfeff' : '#ffffff'
            },
          },
        },
        {
          columns: [
            {
              width: '50%',
              alignment: 'center' as const,
              stack: [
                { text: 'Người lập bảng', style: 'signatureTitle' },
                { text: '(Ký, ghi rõ họ tên)', style: 'signatureSub' },
                { text: '\n\n\n' },
              ],
              margin: [0, 16, 0, 0] as [number, number, number, number],
            },
            {
              width: '50%',
              alignment: 'center' as const,
              stack: [
                { text: 'Giám đốc', style: 'signatureTitle' },
                { text: '(Ký, ghi rõ họ tên)', style: 'signatureSub' },
                { text: '\n\n\n' },
              ],
              margin: [0, 16, 0, 0] as [number, number, number, number],
            },
          ],
        },
      ],
      styles: {
        unitName: {
          bold: true,
          fontSize: 11,
        },
        nationalTitle: {
          bold: true,
          fontSize: 11,
        },
        motto: {
          italics: true,
          fontSize: 10,
          margin: [0, 2, 0, 0] as [number, number, number, number],
        },
        dateLine: {
          fontSize: 10,
          margin: [0, 4, 0, 0] as [number, number, number, number],
        },
        reportTitle: {
          bold: true,
          fontSize: 14,
        },
        tableHeader: {
          color: '#ffffff',
          bold: true,
          fontSize: 8,
        },
        tableTotal: {
          bold: true,
          fontSize: 8,
        },
        signatureTitle: {
          bold: true,
          fontSize: 11,
        },
        signatureSub: {
          fontSize: 9,
        },
      },
      defaultStyle: {
        fontSize: 8,
      },
    }

    pdfMake.createPdf(docDefinition).download(filename)
  }

  const exportCurrentExcel = async () => {
    if (activeTab === 'detail-by-period') {
      const body = periodData.map((item) => [
        item.kyHoaDon,
        item.maHoDan,
        item.tenChuHo,
        item.diaChi,
        item.tuyenThuRac,
        item.nguoiThu,
        item.invoiceSerial || '',
        item.invoiceFkey || '',
        item.daPhatHanh ? 'Có' : 'Không',
        item.tongTien,
        item.thue,
        item.tongCong,
        formatDateTime(item.paymentDate),
      ])

      const totalRow: Array<string | number> = [
        'Tổng cộng',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        periodData.reduce((sum, item) => sum + item.tongTien, 0),
        periodData.reduce((sum, item) => sum + item.thue, 0),
        periodData.reduce((sum, item) => sum + item.tongCong, 0),
        '',
      ]

      await exportSheetToExcel(
        'Báo cáo chi tiết theo kỳ',
        'BaoCaoChiTietKy',
        ['Kỳ hóa đơn', 'Mã hộ', 'Hộ dân', 'Địa chỉ', 'Tuyến đường', 'Người thu', 'Số seri', 'Fkey', 'Đã phát hành', 'Tiền dịch vụ', 'Thuế', 'Tổng tiền', 'Ngày thu'],
        body,
        totalRow,
        `bao-cao-chi-tiet-ky-${fileTimestamp()}.xlsx`,
      )
      return
    }

    if (activeTab === 'detail-by-period-range') {
      const body = periodRangeData.map((item) => [
        item.kyHoaDon,
        item.maHoDan,
        item.tenChuHo,
        item.diaChi,
        item.tuyenThuRac,
        item.nguoiThu,
        item.invoiceSerial || '',
        item.invoiceFkey || '',
        item.daPhatHanh ? 'Có' : 'Không',
        item.tongTien,
        item.thue,
        item.tongCong,
        formatDateTime(item.paymentDate),
      ])

      const totalRow: Array<string | number> = [
        'Tổng cộng',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        periodRangeData.reduce((sum, item) => sum + item.tongTien, 0),
        periodRangeData.reduce((sum, item) => sum + item.thue, 0),
        periodRangeData.reduce((sum, item) => sum + item.tongCong, 0),
        '',
      ]

      await exportSheetToExcel(
        'Báo cáo chi tiết từ kỳ đến kỳ',
        'BaoCaoChiTietKyRange',
        ['Kỳ hóa đơn', 'Mã hộ', 'Hộ dân', 'Địa chỉ', 'Tuyến đường', 'Người thu', 'Số seri', 'Fkey', 'Đã phát hành', 'Tiền dịch vụ', 'Thuế', 'Tổng tiền', 'Ngày thu'],
        body,
        totalRow,
        `bao-cao-chi-tiet-tu-ky-den-ky-${fileTimestamp()}.xlsx`,
      )
      return
    }

    if (activeTab === 'detail-by-date') {
      const body = dateData.map((item) => [
        formatDateTime(item.paymentDate),
        item.kyHoaDon,
        item.maHoDan,
        item.tenChuHo,
        item.diaChi,
        item.tuyenThuRac,
        item.nguoiThu,
        item.invoiceSerial || '',
        item.invoiceFkey || '',
        item.daPhatHanh ? 'Có' : 'Không',
        item.tongCong,
      ])

      const totalRow: Array<string | number> = [
        'Tổng cộng',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        dateData.reduce((sum, item) => sum + item.tongCong, 0),
      ]

      await exportSheetToExcel(
        'Báo cáo chi tiết theo ngày thu',
        'BaoCaoChiTietNgay',
        ['Ngày thu', 'Kỳ hóa đơn', 'Mã hộ', 'Hộ dân', 'Địa chỉ', 'Tuyến đường', 'Người thu', 'Số seri', 'Fkey', 'Đã phát hành', 'Tổng tiền'],
        body,
        totalRow,
        `bao-cao-chi-tiet-ngay-${fileTimestamp()}.xlsx`,
      )
      return
    }

    const body = revenueData.map((item) => [
      item.kyHoaDon,
      item.tuyenThuRac,
      item.loaiDichVu,
      item.tongSoHo,
      item.daThuSoHo,
      item.chuaThuSoHo,
      item.tongTien,
      item.tongThue,
      item.daThuCong,
      item.chuaThuCong,
      item.tongCong,
    ])

    const totalRow: Array<string | number> = [
      'Tổng cộng',
      '',
      '',
      revenueData.reduce((sum, item) => sum + item.tongSoHo, 0),
      revenueData.reduce((sum, item) => sum + item.daThuSoHo, 0),
      revenueData.reduce((sum, item) => sum + item.chuaThuSoHo, 0),
      revenueData.reduce((sum, item) => sum + item.tongTien, 0),
      revenueData.reduce((sum, item) => sum + item.tongThue, 0),
      revenueData.reduce((sum, item) => sum + item.tongCong, 0),
      revenueData.reduce((sum, item) => sum + item.daThuCong, 0),
      revenueData.reduce((sum, item) => sum + item.chuaThuCong, 0),
    ]

    await exportSheetToExcel(
      'Báo cáo tổng hợp doanh số',
      'BaoCaoTongHop',
      ['Kỳ hóa đơn', 'Tuyến đường', 'Loại dịch vụ', 'Tổng số hộ', 'Đã thu (hộ)', 'Chưa thu (hộ)', 'Tiền dịch vụ', 'Thuế', 'Đã thu tiền', 'Chưa thu tiền', 'Tổng tiền'],
      body,
      totalRow,
      `bao-cao-tong-hop-doanh-so-${fileTimestamp()}.xlsx`,
    )
  }

  const exportCurrentPdf = () => {
    if (activeTab === 'detail-by-period') {
      const body = periodData.map((item) => [
        item.kyHoaDon,
        item.maHoDan,
        item.tenChuHo,
        item.diaChi,
        item.tuyenThuRac,
        item.nguoiThu,
        item.invoiceSerial || '',
        item.invoiceFkey || '',
        item.daPhatHanh ? 'Có' : 'Không',
        formatCurrency(item.tongTien),
        formatCurrency(item.thue),
        formatCurrency(item.tongCong),
        formatDateTime(item.paymentDate),
      ])

      exportSimplePdf(
        'Báo cáo chi tiết theo kỳ',
        ['Kỳ', 'Mã hộ', 'Hộ dân', 'Địa chỉ', 'Tuyến', 'Người thu', 'Số seri', 'Fkey', 'Đã PH', 'Tiền DV', 'Thuế', 'Tổng tiền', 'Ngày thu'],
        body,
        [
          'Tổng cộng',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          formatCurrency(periodData.reduce((sum, item) => sum + item.tongTien, 0)),
          formatCurrency(periodData.reduce((sum, item) => sum + item.thue, 0)),
          formatCurrency(periodData.reduce((sum, item) => sum + item.tongCong, 0)),
          '',
        ],
        `bao-cao-chi-tiet-ky-${fileTimestamp()}.pdf`,
      )
      return
    }

    if (activeTab === 'detail-by-period-range') {
      const body = periodRangeData.map((item) => [
        item.kyHoaDon,
        item.maHoDan,
        item.tenChuHo,
        item.diaChi,
        item.tuyenThuRac,
        item.nguoiThu,
        item.invoiceSerial || '',
        item.invoiceFkey || '',
        item.daPhatHanh ? 'Có' : 'Không',
        formatCurrency(item.tongTien),
        formatCurrency(item.thue),
        formatCurrency(item.tongCong),
        formatDateTime(item.paymentDate),
      ])

      exportSimplePdf(
        'Báo cáo chi tiết từ kỳ đến kỳ',
        ['Kỳ', 'Mã hộ', 'Hộ dân', 'Địa chỉ', 'Tuyến', 'Người thu', 'Số seri', 'Fkey', 'Đã PH', 'Tiền DV', 'Thuế', 'Tổng tiền', 'Ngày thu'],
        body,
        [
          'Tổng cộng',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          formatCurrency(periodRangeData.reduce((sum, item) => sum + item.tongTien, 0)),
          formatCurrency(periodRangeData.reduce((sum, item) => sum + item.thue, 0)),
          formatCurrency(periodRangeData.reduce((sum, item) => sum + item.tongCong, 0)),
          '',
        ],
        `bao-cao-chi-tiet-tu-ky-den-ky-${fileTimestamp()}.pdf`,
      )
      return
    }

    if (activeTab === 'detail-by-date') {
      const body = dateData.map((item) => [
        formatDate(item.paymentDate),
        item.kyHoaDon,
        item.maHoDan,
        item.tenChuHo,
        item.diaChi,
        item.tuyenThuRac,
        item.nguoiThu,
        item.invoiceSerial || '',
        item.invoiceFkey || '',
        item.daPhatHanh ? 'Có' : 'Không',
        formatCurrency(item.tongCong),
      ])

      exportSimplePdf(
        'Báo cáo chi tiết theo ngày thu',
        ['Ngày thu', 'Kỳ', 'Mã hộ', 'Hộ dân', 'Địa chỉ', 'Tuyến', 'Người thu', 'Số seri', 'Fkey', 'Đã PH', 'Tổng tiền'],
        body,
        [
          'Tổng cộng',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          formatCurrency(dateData.reduce((sum, item) => sum + item.tongCong, 0)),
        ],
        `bao-cao-chi-tiet-ngay-${fileTimestamp()}.pdf`,
      )
      return
    }

    const body = revenueData.map((item) => [
      item.kyHoaDon,
      item.tuyenThuRac,
      item.loaiDichVu,
      item.tongSoHo,
      item.daThuSoHo,
      item.chuaThuSoHo,
      formatCurrency(item.tongTien),
      formatCurrency(item.tongThue),
      formatCurrency(item.daThuCong),
      formatCurrency(item.chuaThuCong),
      formatCurrency(item.tongCong),
    ])

    exportSimplePdf(
      'Báo cáo tổng hợp doanh số',
      ['Kỳ', 'Tuyến', 'Dịch vụ', 'Tổng hộ', 'Đã thu', 'Chưa thu', 'Tiền DV', 'Thuế', 'Đã thu tiền', 'Chưa thu tiền', 'Tổng tiền'],
      body,
      [
        'Tổng cộng',
        '',
        '',
        revenueData.reduce((sum, item) => sum + item.tongSoHo, 0),
        revenueData.reduce((sum, item) => sum + item.daThuSoHo, 0),
        revenueData.reduce((sum, item) => sum + item.chuaThuSoHo, 0),
        formatCurrency(revenueData.reduce((sum, item) => sum + item.tongTien, 0)),
        formatCurrency(revenueData.reduce((sum, item) => sum + item.tongThue, 0)),
        formatCurrency(revenueData.reduce((sum, item) => sum + item.daThuCong, 0)),
        formatCurrency(revenueData.reduce((sum, item) => sum + item.chuaThuCong, 0)),
        formatCurrency(revenueData.reduce((sum, item) => sum + item.tongCong, 0)),
      ],
      `bao-cao-tong-hop-doanh-so-${fileTimestamp()}.pdf`,
    )
  }

  return (
    <Card className="page-card" variant="borderless">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Báo cáo
          </Typography.Title>
          <Space>
            <Button className="excel-green-btn" icon={<FileExcelOutlined />} onClick={exportCurrentExcel}>
              Xuất Excel
            </Button>
            <Button className="report-pdf-btn" icon={<FilePdfOutlined />} onClick={exportCurrentPdf}>
              Xuất PDF
            </Button>
          </Space>
        </Space>

        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'detail-by-period' | 'detail-by-period-range' | 'detail-by-date' | 'revenue-summary')}
          items={[
            {
              key: 'detail-by-period',
              label: 'Chi tiết theo kỳ',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Card size="small" style={{ background: '#f8fbff' }}>
                    <Form form={periodForm} layout="inline">
                      <Space wrap>
                        <Form.Item name="kyHoaDon" style={{ marginBottom: 0 }}>
                          <Select
                            allowClear
                            options={periodOptions}
                            style={{ width: 220 }}
                            placeholder="Kỳ hóa đơn"
                            showSearch
                            optionFilterProp="label"
                          />
                        </Form.Item>
                        <Form.Item name="collectorId" style={{ marginBottom: 0 }}>
                          <Select
                            allowClear
                            options={collectorOptions}
                            style={{ width: 230 }}
                            placeholder="Người thu"
                            showSearch
                            optionFilterProp="label"
                          />
                        </Form.Item>
                        <Form.Item name="routeId" style={{ marginBottom: 0 }}>
                          <Select
                            allowClear
                            options={routeOptions}
                            style={{ width: 220 }}
                            placeholder="Tuyến đường"
                            showSearch
                            optionFilterProp="label"
                          />
                        </Form.Item>
                        <Button type="primary" icon={<SearchOutlined />} loading={periodLoading} onClick={() => void searchDetailByPeriod()}>
                          Xem báo cáo
                        </Button>
                      </Space>
                    </Form>
                  </Card>

                  {periodSummary ? (
                    <Space wrap>
                      <Tag color="blue">Hộ đã thu: {periodSummary.soHoDaThu ?? 0}</Tag>
                      <Tag color="success">Đã phát hành: {periodSummary.soHoaDonDaPhatHanh ?? 0}</Tag>
                      <Tag color="processing">Tiền DV: {formatCurrency(periodSummary.tongTien)}</Tag>
                      <Tag color="warning">Thuế: {formatCurrency(periodSummary.thue ?? 0)}</Tag>
                      <Tag color="purple">Tổng cộng: {formatCurrency(periodSummary.tongCong)}</Tag>
                    </Space>
                  ) : null}

                  <Table
                    rowKey="invoiceId"
                    loading={periodLoading}
                    dataSource={periodData}
                    scroll={{ x: 1800 }}
                    columns={[
                      { title: 'Kỳ', dataIndex: 'kyHoaDon', width: 110 },
                      { title: 'Mã hộ', dataIndex: 'maHoDan', width: 110 },
                      { title: 'Hộ dân', dataIndex: 'tenChuHo', width: 180 },
                      { title: 'Địa chỉ', dataIndex: 'diaChi', width: 220 },
                      { title: 'Tuyến đường', dataIndex: 'tuyenThuRac', width: 160 },
                      { title: 'Người thu', dataIndex: 'nguoiThu', width: 160 },
                      {
                        title: 'Phát hành',
                        width: 100,
                        render: (_, record) =>
                          record.daPhatHanh ? <Tag color="success">Đã phát hành</Tag> : <Tag>Chưa</Tag>,
                      },
                      { title: 'Số seri', dataIndex: 'invoiceSerial', width: 130 },
                      { title: 'Fkey', dataIndex: 'invoiceFkey', width: 180 },
                      {
                        title: 'Tổng tiền',
                        width: 150,
                        render: (_, record) => formatCurrency(record.tongCong),
                      },
                      {
                        title: 'Ngày thu',
                        width: 160,
                        render: (_, record) =>
                          record.paymentDate ? formatDateTime(record.paymentDate) : '---',
                      },
                    ]}
                    summary={() => (
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={9}>
                          <Typography.Text strong>Tổng cộng</Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={9}>
                          <Typography.Text strong>
                            {formatCurrency(periodData.reduce((sum, item) => sum + item.tongCong, 0))}
                          </Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={10}> </Table.Summary.Cell>
                      </Table.Summary.Row>
                    )}
                    pagination={false}
                  />
                </Space>
              ),
            },
            {
              key: 'detail-by-period-range',
              label: 'Từ kỳ đến kỳ',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Card size="small" style={{ background: '#f8fbff' }}>
                    <Form form={periodRangeForm} layout="inline">
                      <Space wrap>
                        <Form.Item name="fromKy" style={{ marginBottom: 0 }}>
                          <Select
                            allowClear
                            options={periodOptions}
                            style={{ width: 220 }}
                            placeholder="Từ kỳ"
                            showSearch
                            optionFilterProp="label"
                          />
                        </Form.Item>
                        <Form.Item name="toKy" style={{ marginBottom: 0 }}>
                          <Select
                            allowClear
                            options={periodOptions}
                            style={{ width: 220 }}
                            placeholder="Đến kỳ"
                            showSearch
                            optionFilterProp="label"
                          />
                        </Form.Item>
                        <Form.Item name="collectorId" style={{ marginBottom: 0 }}>
                          <Select
                            allowClear
                            options={collectorOptions}
                            style={{ width: 230 }}
                            placeholder="Người thu"
                            showSearch
                            optionFilterProp="label"
                          />
                        </Form.Item>
                        <Form.Item name="routeId" style={{ marginBottom: 0 }}>
                          <Select
                            allowClear
                            options={routeOptions}
                            style={{ width: 220 }}
                            placeholder="Tuyến đường"
                            showSearch
                            optionFilterProp="label"
                          />
                        </Form.Item>
                        <Button type="primary" icon={<SearchOutlined />} loading={periodRangeLoading} onClick={() => void searchDetailByPeriodRange()}>
                          Xem báo cáo
                        </Button>
                      </Space>
                    </Form>
                  </Card>

                  {periodRangeSummary ? (
                    <Space wrap>
                      <Tag color="blue">Hộ đã thu: {periodRangeSummary.soHoDaThu ?? 0}</Tag>
                      <Tag color="success">Đã phát hành: {periodRangeSummary.soHoaDonDaPhatHanh ?? 0}</Tag>
                      <Tag color="processing">Tiền DV: {formatCurrency(periodRangeSummary.tongTien)}</Tag>
                      <Tag color="warning">Thuế: {formatCurrency(periodRangeSummary.thue ?? 0)}</Tag>
                      <Tag color="purple">Tổng cộng: {formatCurrency(periodRangeSummary.tongCong)}</Tag>
                    </Space>
                  ) : null}

                  <Table
                    rowKey="invoiceId"
                    loading={periodRangeLoading}
                    dataSource={periodRangeData}
                    scroll={{ x: 1900 }}
                    columns={[
                      { title: 'Kỳ', dataIndex: 'kyHoaDon', width: 110 },
                      { title: 'Mã hộ', dataIndex: 'maHoDan', width: 110 },
                      { title: 'Hộ dân', dataIndex: 'tenChuHo', width: 180 },
                      { title: 'Địa chỉ', dataIndex: 'diaChi', width: 220 },
                      { title: 'Tuyến đường', dataIndex: 'tuyenThuRac', width: 160 },
                      { title: 'Người thu', dataIndex: 'nguoiThu', width: 160 },
                      {
                        title: 'Phát hành',
                        width: 100,
                        render: (_, record) =>
                          record.daPhatHanh ? <Tag color="success">Đã phát hành</Tag> : <Tag>Chưa</Tag>,
                      },
                      { title: 'Số seri', dataIndex: 'invoiceSerial', width: 130 },
                      { title: 'Fkey', dataIndex: 'invoiceFkey', width: 180 },
                      {
                        title: 'Tổng tiền',
                        width: 150,
                        render: (_, record) => formatCurrency(record.tongCong),
                      },
                      {
                        title: 'Ngày thu',
                        width: 160,
                        render: (_, record) =>
                          record.paymentDate ? formatDateTime(record.paymentDate) : '---',
                      },
                    ]}
                    summary={() => (
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={9}>
                          <Typography.Text strong>Tổng cộng</Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={9}>
                          <Typography.Text strong>
                            {formatCurrency(periodRangeData.reduce((sum, item) => sum + item.tongCong, 0))}
                          </Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={10}> </Table.Summary.Cell>
                      </Table.Summary.Row>
                    )}
                    pagination={false}
                  />
                </Space>
              ),
            },
            {
              key: 'detail-by-date',
              label: 'Chi tiết theo ngày',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Card size="small" style={{ background: '#f8fbff' }}>
                    <Form form={dateForm} layout="inline">
                      <Space wrap>
                        <Form.Item name="dateRange" style={{ marginBottom: 0 }}>
                          <DatePicker.RangePicker format="DD/MM/YYYY" />
                        </Form.Item>
                        <Form.Item name="collectorId" style={{ marginBottom: 0 }}>
                          <Select
                            allowClear
                            options={collectorOptions}
                            style={{ width: 230 }}
                            placeholder="Người thu"
                            showSearch
                            optionFilterProp="label"
                          />
                        </Form.Item>
                        <Form.Item name="routeId" style={{ marginBottom: 0 }}>
                          <Select
                            allowClear
                            options={routeOptions}
                            style={{ width: 220 }}
                            placeholder="Tuyến đường"
                            showSearch
                            optionFilterProp="label"
                          />
                        </Form.Item>
                        <Button type="primary" icon={<SearchOutlined />} loading={dateLoading} onClick={() => void searchDetailByDate()}>
                          Xem báo cáo
                        </Button>
                      </Space>
                    </Form>
                  </Card>

                  {dateSummary ? (
                    <Space wrap>
                      <Tag color="blue">Hộ đã thu: {dateSummary.soHoDaThu ?? 0}</Tag>
                      <Tag color="success">Đã phát hành: {dateSummary.soHoaDonDaPhatHanh ?? 0}</Tag>
                      <Tag color="purple">Tổng cộng: {formatCurrency(dateSummary.tongCong)}</Tag>
                    </Space>
                  ) : null}

                  <Table
                    rowKey="invoiceId"
                    loading={dateLoading}
                    dataSource={dateData}
                    scroll={{ x: 1700 }}
                    columns={[
                      {
                        title: 'Ngày thu',
                        width: 140,
                        render: (_, record) =>
                          record.paymentDate ? formatDate(record.paymentDate) : '---',
                      },
                      { title: 'Kỳ', dataIndex: 'kyHoaDon', width: 110 },
                      { title: 'Mã hộ', dataIndex: 'maHoDan', width: 110 },
                      { title: 'Hộ dân', dataIndex: 'tenChuHo', width: 180 },
                      { title: 'Tuyến đường', dataIndex: 'tuyenThuRac', width: 160 },
                      { title: 'Người thu', dataIndex: 'nguoiThu', width: 160 },
                      {
                        title: 'Tổng tiền',
                        width: 150,
                        render: (_, record) => formatCurrency(record.tongCong),
                      },
                    ]}
                    summary={() => (
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={6}>
                          <Typography.Text strong>Tổng cộng</Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={6}>
                          <Typography.Text strong>
                            {formatCurrency(dateData.reduce((sum, item) => sum + item.tongCong, 0))}
                          </Typography.Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    )}
                    pagination={false}
                  />

                  <Typography.Text strong>Tổng hợp theo ngày thu tiền</Typography.Text>
                  <Table
                    rowKey="ngayThuTien"
                    size="small"
                    loading={dateLoading}
                    dataSource={dateDailySummary}
                    columns={[
                      { title: 'Ngày thu', dataIndex: 'ngayThuTien', width: 160 },
                      { title: 'Số hộ đã thu', dataIndex: 'soHoDaThu', width: 140 },
                      {
                        title: 'Tổng tiền',
                        render: (_, record) => formatCurrency(record.tongTien),
                        width: 170,
                      },
                    ]}
                    summary={() => (
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={2}>
                          <Typography.Text strong>Tổng cộng</Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2}>
                          <Typography.Text strong>
                            {formatCurrency(dateDailySummary.reduce((sum, item) => sum + item.tongTien, 0))}
                          </Typography.Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    )}
                    pagination={false}
                  />
                </Space>
              ),
            },
            {
              key: 'revenue-summary',
              label: 'Tổng hợp doanh số',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Card size="small" style={{ background: '#f8fbff' }}>
                    <Form form={revenueForm} layout="inline">
                      <Space wrap>
                        <Form.Item name="kyHoaDon" style={{ marginBottom: 0 }}>
                          <Select
                            allowClear
                            options={periodOptions}
                            style={{ width: 220 }}
                            placeholder="Kỳ hóa đơn"
                            showSearch
                            optionFilterProp="label"
                          />
                        </Form.Item>
                        <Form.Item name="routeId" style={{ marginBottom: 0 }}>
                          <Select
                            allowClear
                            options={routeOptions}
                            style={{ width: 220 }}
                            placeholder="Tuyến đường"
                            showSearch
                            optionFilterProp="label"
                          />
                        </Form.Item>
                        <Form.Item name="serviceCatalogId" style={{ marginBottom: 0 }}>
                          <Select
                            allowClear
                            options={serviceOptions}
                            style={{ width: 240 }}
                            placeholder="Loại dịch vụ"
                            showSearch
                            optionFilterProp="label"
                          />
                        </Form.Item>
                        <Button type="primary" icon={<SearchOutlined />} loading={revenueLoading} onClick={() => void searchRevenueSummary()}>
                          Xem báo cáo
                        </Button>
                      </Space>
                    </Form>
                  </Card>

                  {revenueSummary ? (
                    <Space wrap>
                      <Tag color="blue">Tổng số hộ: {revenueSummary.tongSoHo}</Tag>
                      <Tag color="success">Đã thu: {revenueSummary.daThuSoHo}</Tag>
                      <Tag color="warning">Chưa thu: {revenueSummary.chuaThuSoHo}</Tag>
                      <Tag color="processing">Tiền DV: {formatCurrency(revenueSummary.tongTien)}</Tag>
                      <Tag color="warning">Thuế: {formatCurrency(revenueSummary.tongThue)}</Tag>
                      <Tag color="purple">Tổng cộng: {formatCurrency(revenueSummary.tongCong)}</Tag>
                      <Tag color="green">Đã thu tiền: {formatCurrency(revenueSummary.daThuCong)}</Tag>
                      <Tag color="gold">Chưa thu tiền: {formatCurrency(revenueSummary.chuaThuCong)}</Tag>
                    </Space>
                  ) : null}

                  <Table
                    rowKey={(record) => `${record.tuyenThuRac}-${record.loaiDichVu}`}
                    loading={revenueLoading}
                    dataSource={revenueData}
                    scroll={{ x: 1400 }}
                    columns={[
                      { title: 'Kỳ', dataIndex: 'kyHoaDon', width: 110 },
                      { title: 'Tuyến đường', dataIndex: 'tuyenThuRac', width: 220 },
                      { title: 'Loại dịch vụ', dataIndex: 'loaiDichVu', width: 220 },
                      { title: 'Tổng số hộ', dataIndex: 'tongSoHo', width: 120 },
                      { title: 'Đã thu (hộ)', dataIndex: 'daThuSoHo', width: 120 },
                      { title: 'Chưa thu (hộ)', dataIndex: 'chuaThuSoHo', width: 120 },
                      {
                        title: 'Tiền dịch vụ',
                        width: 150,
                        render: (_, record) => formatCurrency(record.tongTien),
                      },
                      {
                        title: 'Thuế',
                        width: 150,
                        render: (_, record) => formatCurrency(record.tongThue),
                      },
                      {
                        title: 'Đã thu tiền',
                        width: 150,
                        render: (_, record) => formatCurrency(record.daThuCong),
                      },
                      {
                        title: 'Chưa thu tiền',
                        width: 150,
                        render: (_, record) => formatCurrency(record.chuaThuCong),
                      },
                      {
                        title: 'Tổng tiền',
                        width: 150,
                        render: (_, record) => formatCurrency(record.tongCong),
                      },
                    ]}
                    summary={() => (
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={3}>
                          <Typography.Text strong>Tổng cộng</Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3}>
                          <Typography.Text strong>
                            {revenueData.reduce((sum, item) => sum + item.tongSoHo, 0)}
                          </Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={4}>
                          <Typography.Text strong>
                            {revenueData.reduce((sum, item) => sum + item.daThuSoHo, 0)}
                          </Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={5}>
                          <Typography.Text strong>
                            {revenueData.reduce((sum, item) => sum + item.chuaThuSoHo, 0)}
                          </Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={6}>
                          <Typography.Text strong>
                            {formatCurrency(revenueData.reduce((sum, item) => sum + item.tongTien, 0))}
                          </Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={7}>
                          <Typography.Text strong>
                            {formatCurrency(revenueData.reduce((sum, item) => sum + item.tongThue, 0))}
                          </Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={8}>
                          <Typography.Text strong>
                            {formatCurrency(revenueData.reduce((sum, item) => sum + item.daThuCong, 0))}
                          </Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={9}>
                          <Typography.Text strong>
                            {formatCurrency(revenueData.reduce((sum, item) => sum + item.chuaThuCong, 0))}
                          </Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={10}>
                          <Typography.Text strong>
                            {formatCurrency(revenueData.reduce((sum, item) => sum + item.tongCong, 0))}
                          </Typography.Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    )}
                    pagination={false}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Space>
    </Card>
  )
}
