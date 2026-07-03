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
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
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
  initialTab?: 'detail-by-period' | 'detail-by-date' | 'revenue-summary'
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

export function ReportsPage({ initialTab = 'detail-by-period' }: ReportsPageProps) {
  const [billingPeriods, setBillingPeriods] = useState<BillingPeriodItem[]>([])
  const [routes, setRoutes] = useState<RouteItem[]>([])
  const [services, setServices] = useState<ServiceCatalogItem[]>([])
  const [collectors, setCollectors] = useState<UserListItem[]>([])

  const [activeTab, setActiveTab] = useState<'detail-by-period' | 'detail-by-date' | 'revenue-summary'>(initialTab)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const [periodData, setPeriodData] = useState<InvoiceDetailReportResponse['data']>([])
  const [periodSummary, setPeriodSummary] = useState<InvoiceDetailReportResponse['summary'] | null>(null)
  const [periodLoading, setPeriodLoading] = useState(false)

  const [dateData, setDateData] = useState<InvoiceDetailByDateReportResponse['data']>([])
  const [dateDailySummary, setDateDailySummary] = useState<InvoiceDetailByDateReportResponse['tongHopTheoNgay']>([])
  const [dateSummary, setDateSummary] = useState<InvoiceDetailByDateReportResponse['summary'] | null>(null)
  const [dateLoading, setDateLoading] = useState(false)

  const [revenueData, setRevenueData] = useState<InvoiceRevenueSummaryResponse['data']>([])
  const [revenueSummary, setRevenueSummary] = useState<InvoiceRevenueSummaryResponse['summary'] | null>(null)
  const [revenueLoading, setRevenueLoading] = useState(false)

  const [periodForm] = Form.useForm<PeriodDetailFilter>()
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

  const exportSheetToExcel = (
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

    const aoa: Array<Array<string | number>> = [headers, ...body, totalRow, [], []]
    aoa.push(['', '', 'Người lập bảng', '', '', '', 'Giám đốc'])
    aoa.push(['', '', '(Ký, ghi rõ họ tên)', '', '', '', '(Ký, ghi rõ họ tên)'])
    aoa.push(['', '', '', '', '', '', ''])
    aoa.push(['', '', '', '', '', '', ''])

    const worksheet = XLSX.utils.aoa_to_sheet(aoa)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    XLSX.writeFile(workbook, filename)
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

    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text(title, 14, 14)

    autoTable(doc, {
      startY: 20,
      head: [headers],
      body: [...body, totalRow],
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [10, 91, 216],
        textColor: 255,
      },
      didParseCell: (hookData) => {
        const isTotalRow = hookData.row.index === body.length
        if (hookData.section === 'body' && isTotalRow) {
          hookData.cell.styles.fontStyle = 'bold'
          hookData.cell.styles.fillColor = [235, 245, 255]
        }
      },
    })

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 30
    const signatureY = Math.min(finalY + 14, 178)

    if (signatureY > 170) {
      doc.addPage('a4', 'landscape')
      doc.setFontSize(11)
      doc.text('Người lập bảng', 70, 24, { align: 'center' })
      doc.text('Giám đốc', 220, 24, { align: 'center' })
      doc.setFontSize(9)
      doc.text('(Ký, ghi rõ họ tên)', 70, 30, { align: 'center' })
      doc.text('(Ký, ghi rõ họ tên)', 220, 30, { align: 'center' })
    } else {
      doc.setFontSize(11)
      doc.text('Người lập bảng', 70, signatureY, { align: 'center' })
      doc.text('Giám đốc', 220, signatureY, { align: 'center' })
      doc.setFontSize(9)
      doc.text('(Ký, ghi rõ họ tên)', 70, signatureY + 6, { align: 'center' })
      doc.text('(Ký, ghi rõ họ tên)', 220, signatureY + 6, { align: 'center' })
    }

    doc.save(filename)
  }

  const exportCurrentExcel = () => {
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

      exportSheetToExcel(
        'BaoCaoChiTietKy',
        ['Kỳ hóa đơn', 'Mã hộ', 'Hộ dân', 'Địa chỉ', 'Tuyến đường', 'Người thu', 'Số seri', 'Fkey', 'Đã phát hành', 'Tiền dịch vụ', 'Thuế', 'Tổng tiền', 'Ngày thu'],
        body,
        totalRow,
        `bao-cao-chi-tiet-ky-${fileTimestamp()}.xlsx`,
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

      exportSheetToExcel(
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
      item.tongTien,
      item.tongThue,
      item.tongCong,
    ])

    const totalRow: Array<string | number> = [
      'Tổng cộng',
      '',
      '',
      revenueData.reduce((sum, item) => sum + item.tongSoHo, 0),
      revenueData.reduce((sum, item) => sum + item.daThuSoHo, 0),
      revenueData.reduce((sum, item) => sum + item.tongTien, 0),
      revenueData.reduce((sum, item) => sum + item.tongThue, 0),
      revenueData.reduce((sum, item) => sum + item.tongCong, 0),
    ]

    exportSheetToExcel(
      'BaoCaoTongHop',
      ['Kỳ hóa đơn', 'Tuyến đường', 'Loại dịch vụ', 'Tổng số hộ', 'Đã thu (hộ)', 'Tiền dịch vụ', 'Thuế', 'Tổng tiền'],
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
        item.tuyenThuRac,
        item.nguoiThu,
        item.daPhatHanh ? 'Có' : 'Không',
        formatCurrency(item.tongCong),
      ])

      exportSimplePdf(
        'Báo cáo chi tiết theo kỳ',
        ['Kỳ', 'Mã hộ', 'Hộ dân', 'Tuyến', 'Người thu', 'Đã PH', 'Tổng tiền'],
        body,
        ['Tổng cộng', '', '', '', '', '', formatCurrency(periodData.reduce((sum, item) => sum + item.tongCong, 0))],
        `bao-cao-chi-tiet-ky-${fileTimestamp()}.pdf`,
      )
      return
    }

    if (activeTab === 'detail-by-date') {
      const body = dateData.map((item) => [
        formatDate(item.paymentDate),
        item.kyHoaDon,
        item.maHoDan,
        item.tenChuHo,
        item.tuyenThuRac,
        item.nguoiThu,
        formatCurrency(item.tongCong),
      ])

      exportSimplePdf(
        'Báo cáo chi tiết theo ngày thu',
        ['Ngày thu', 'Kỳ', 'Mã hộ', 'Hộ dân', 'Tuyến', 'Người thu', 'Tổng tiền'],
        body,
        ['Tổng cộng', '', '', '', '', '', formatCurrency(dateData.reduce((sum, item) => sum + item.tongCong, 0))],
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
      formatCurrency(item.tongCong),
    ])

    exportSimplePdf(
      'Báo cáo tổng hợp doanh số',
      ['Kỳ', 'Tuyến', 'Dịch vụ', 'Tổng hộ', 'Đã thu', 'Tổng tiền'],
      body,
      [
        'Tổng cộng',
        '',
        '',
        revenueData.reduce((sum, item) => sum + item.tongSoHo, 0),
        revenueData.reduce((sum, item) => sum + item.daThuSoHo, 0),
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
            <Button icon={<FileExcelOutlined />} onClick={exportCurrentExcel}>
              Xuất Excel
            </Button>
            <Button icon={<FilePdfOutlined />} onClick={exportCurrentPdf}>
              Xuất PDF
            </Button>
          </Space>
        </Space>

        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'detail-by-period' | 'detail-by-date' | 'revenue-summary')}
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
                      <Tag color="processing">Tiền DV: {formatCurrency(revenueSummary.tongTien)}</Tag>
                      <Tag color="warning">Thuế: {formatCurrency(revenueSummary.tongThue)}</Tag>
                      <Tag color="purple">Tổng cộng: {formatCurrency(revenueSummary.tongCong)}</Tag>
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
                            {formatCurrency(revenueData.reduce((sum, item) => sum + item.tongTien, 0))}
                          </Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={6}>
                          <Typography.Text strong>
                            {formatCurrency(revenueData.reduce((sum, item) => sum + item.tongThue, 0))}
                          </Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={7}>
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
