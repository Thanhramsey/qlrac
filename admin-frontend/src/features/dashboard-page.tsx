import { Button, Card, Col, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd'
import { BarChartOutlined, ReloadOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/axios.instance'
import type { BillingPeriodItem, DashboardOverviewResponse } from '../types'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function statusColor(status: 'PAID' | 'UNPAID' | 'OVERDUE') {
  if (status === 'PAID') {
    return 'success'
  }

  if (status === 'OVERDUE') {
    return 'error'
  }

  return 'warning'
}

function statusLabel(status: 'PAID' | 'UNPAID' | 'OVERDUE') {
  if (status === 'PAID') {
    return 'Đã thanh toán'
  }

  if (status === 'OVERDUE') {
    return 'Quá hạn'
  }

  return 'Chưa thanh toán'
}

export function DashboardPage() {
  const [loading, setLoading] = useState(false)
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null)
  const [billingPeriods, setBillingPeriods] = useState<BillingPeriodItem[]>([])
  const [selectedKyHoaDons, setSelectedKyHoaDons] = useState<string[]>([])

  const billingPeriodOptions = useMemo(
    () =>
      billingPeriods.map((item) => ({
        value: item.maKy,
        label: `${item.tenKy} (${item.maKy})`,
      })),
    [billingPeriods],
  )

  const loadBillingPeriods = async () => {
    try {
      const response = await apiClient.get<{ data: BillingPeriodItem[] }>('/billing-periods', {
        params: { page: 1, limit: 1000 },
      })
      setBillingPeriods(response.data.data ?? [])
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách kỳ hóa đơn')
    }
  }

  const loadOverview = async () => {
    setLoading(true)
    try {
      const response = await apiClient.get<DashboardOverviewResponse>('/dashboard/overview', {
        params: selectedKyHoaDons.length > 0 ? { kyHoaDon: selectedKyHoaDons.join(',') } : undefined,
      })
      setOverview(response.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được dữ liệu dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      await loadBillingPeriods()
    })()
  }, [])

  useEffect(() => {
    void loadOverview()
  }, [selectedKyHoaDons])

  const maxInvoiceCount = useMemo(() => {
    const values =
      overview?.invoiceTrendChart?.flatMap((item) => [item.paidRevenue, item.needToCollectRevenue]) ?? []
    const max = Math.max(0, ...values)
    return max > 0 ? max : 1
  }, [overview])

  const maxPaidRevenue = useMemo(() => {
    const values = overview?.invoiceTrendChart?.map((item) => item.paidRevenue) ?? []
    const max = Math.max(0, ...values)
    return max > 0 ? max : 1
  }, [overview])

  const lineChartPoints = useMemo(() => {
    const series = overview?.invoiceTrendChart ?? []
    const width = 720
    const height = 200
    const paddingX = 36
    const paddingY = 18
    const plotWidth = width - paddingX * 2
    const plotHeight = height - paddingY * 2
    const step = series.length > 1 ? plotWidth / (series.length - 1) : plotWidth

    return series.map((item, index) => ({
      x: paddingX + index * step,
      y: paddingY + plotHeight - (item.paidRevenue / maxPaidRevenue) * plotHeight,
      value: item.paidRevenue,
      label: item.tenKy,
      period: item.maKy,
    }))
  }, [overview, maxPaidRevenue])

  const paidRevenuePath = useMemo(() => {
    if (lineChartPoints.length === 0) {
      return ''
    }

    return lineChartPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ')
  }, [lineChartPoints])

  const revenueTicks = useMemo(
    () => [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxPaidRevenue * ratio)),
    [maxPaidRevenue],
  )

  const shouldShowLineChart = (overview?.invoiceTrendChart?.length ?? 0) >= 2

  const columns = [
    {
      title: 'Kỳ',
      dataIndex: 'kyHoaDon',
      key: 'kyHoaDon',
      width: 120,
    },
    {
      title: 'Mã hộ',
      key: 'maHoDan',
      render: (_: unknown, record: DashboardOverviewResponse['recentInvoices'][number]) => record.household.maHoDan,
      width: 120,
    },
    {
      title: 'Chủ hộ',
      key: 'tenChuHo',
      render: (_: unknown, record: DashboardOverviewResponse['recentInvoices'][number]) => record.household.tenChuHo,
    },
    {
      title: 'Trạng thái',
      key: 'trangThaiThanhToan',
      render: (_: unknown, record: DashboardOverviewResponse['recentInvoices'][number]) => (
        <Tag color={statusColor(record.trangThaiThanhToan)}>{statusLabel(record.trangThaiThanhToan)}</Tag>
      ),
      width: 160,
    },
    {
      title: 'Tổng thanh toán',
      key: 'tongThanhToan',
      align: 'right' as const,
      render: (_: unknown, record: DashboardOverviewResponse['recentInvoices'][number]) =>
        formatCurrency(record.tongThanhToan),
      width: 180,
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="page-card" loading={loading}>
        <Space className="dashboard-title-row" align="start">
          <Typography.Title level={4} style={{ margin: 0 }}>
            Dashboard tổng quan đơn vị
          </Typography.Title>
          <Space align="center" wrap>
            <Select
              mode="multiple"
              allowClear
              maxTagCount="responsive"
              style={{ width: 360 }}
              placeholder="Chọn một hoặc nhiều kỳ hóa đơn"
              options={billingPeriodOptions}
              value={selectedKyHoaDons}
              onChange={(value) => setSelectedKyHoaDons(value)}
              showSearch
              optionFilterProp="label"
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                void loadOverview()
              }}
            >
              Làm mới
            </Button>
          </Space>
        </Space>

        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          {selectedKyHoaDons.length > 0
            ? `Đang xem dữ liệu cho ${selectedKyHoaDons.length} kỳ đã chọn.`
            : 'Đang xem dữ liệu tổng hợp tất cả các kỳ hóa đơn.'}
        </Typography.Paragraph>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card className="page-card" loading={loading}>
            <Statistic title="Tổng hộ dân đang hoạt động" value={overview?.summary.totalHouseholds ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className="page-card" loading={loading}>
            <Statistic title="Tổng người dùng" value={overview?.summary.totalUsers ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className="page-card" loading={loading}>
            <Statistic title="Tổng tuyến thu gom" value={overview?.summary.totalRoutes ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className="page-card" loading={loading}>
            <Statistic title="Tổng số hóa đơn" value={overview?.summary.totalInvoices ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className="page-card" loading={loading}>
            <Statistic
              title="Doanh thu đã thu"
              value={overview?.summary.paidRevenue ?? 0}
              formatter={(value) => formatCurrency(Number(value ?? 0))}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className="page-card" loading={loading}>
            <Statistic
              title="Tổng cần thu"
              value={overview?.summary.totalNeedToCollect ?? 0}
              formatter={(value) => formatCurrency(Number(value ?? 0))}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card className="page-card" loading={loading} title="Biểu đồ doanh thu đã thu / chưa thu theo kỳ">
            <div className="dashboard-chart-wrap">
              {(overview?.invoiceTrendChart ?? []).map((item) => {
                const paidHeight = Math.max(12, Math.round((item.paidRevenue / maxInvoiceCount) * 100))
                const unpaidHeight = Math.max(12, Math.round((item.needToCollectRevenue / maxInvoiceCount) * 100))

                return (
                  <Tooltip
                    overlayClassName="dashboard-chart-tooltip"
                    key={item.maKy}
                    title={
                      <Space direction="vertical" size={0}>
                        <Typography.Text strong style={{ color: '#f8fcff' }}>
                          {item.tenKy}
                        </Typography.Text>
                        <Typography.Text style={{ color: '#e5eef7' }}>
                          Đã thu: {formatCurrency(item.paidRevenue)} ({item.paidInvoices} hóa đơn)
                        </Typography.Text>
                        <Typography.Text style={{ color: '#e5eef7' }}>
                          Chưa thu: {formatCurrency(item.needToCollectRevenue)} ({item.unpaidInvoices + item.overdueInvoices}{' '}
                          hóa đơn)
                        </Typography.Text>
                        <Typography.Text style={{ color: '#f8fcff' }}>
                          Tổng: {formatCurrency(item.paidRevenue + item.needToCollectRevenue)}
                        </Typography.Text>
                      </Space>
                    }
                  >
                    <div className="dashboard-chart-item">
                      <div className="dashboard-bar-stack">
                        <div className="dashboard-bar-group">
                          <div className="dashboard-bar-main dashboard-bar-paid" style={{ height: `${paidHeight}%` }}>
                            <span>{formatCurrency(item.paidRevenue)}</span>
                          </div>
                          <div className="dashboard-bar-main dashboard-bar-unpaid" style={{ height: `${unpaidHeight}%` }}>
                            <span>{formatCurrency(item.needToCollectRevenue)}</span>
                          </div>
                        </div>
                      </div>
                      <Typography.Text className="dashboard-chart-label">{item.tenKy}</Typography.Text>
                    </div>
                  </Tooltip>
                )
              })}
            </div>
            <Space style={{ marginTop: 12 }} wrap>
              <Tag color="success">Đã thu</Tag>
              <Tag color="warning">Chưa thu + quá hạn</Tag>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card className="page-card" loading={loading} title="Cơ cấu trạng thái hóa đơn">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {(overview?.invoiceStatusChart ?? []).map((item) => (
                <div key={item.key} className="dashboard-status-row">
                  <Typography.Text>{item.label}</Typography.Text>
                  <Tag color={statusColor(item.key)}>{item.count}</Tag>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {shouldShowLineChart ? (
        <Card className="page-card" loading={loading} title="Line chart doanh thu đã thu theo kỳ">
        <div className="dashboard-line-chart-wrap">
          <svg viewBox="0 0 720 200" className="dashboard-line-chart-svg" role="img" aria-label="Doanh thu đã thu theo kỳ">
            {revenueTicks.map((tick, index) => {
              const y = 170 - (index * 130) / 4
              return (
                <g key={`${tick}-${index}`}>
                  <line x1="36" y1={y} x2="684" y2={y} className="dashboard-line-grid" />
                  <text x="14" y={y + 4} className="dashboard-line-axis-label">
                    {formatCurrency(tick)}
                  </text>
                </g>
              )
            })}

            {lineChartPoints.length > 0 ? <path d={paidRevenuePath} className="dashboard-line-path" /> : null}
            {lineChartPoints.map((point) => (
              <Tooltip
                overlayClassName="dashboard-chart-tooltip"
                key={point.period}
                title={
                  <Space direction="vertical" size={0}>
                    <Typography.Text strong style={{ color: '#f8fcff' }}>
                      {point.label}
                    </Typography.Text>
                    <Typography.Text style={{ color: '#e5eef7' }}>
                      Doanh thu đã thu: {formatCurrency(point.value)}
                    </Typography.Text>
                  </Space>
                }
              >
                <circle cx={point.x} cy={point.y} r="6" className="dashboard-line-point" />
              </Tooltip>
            ))}
          </svg>

          <div className="dashboard-line-label-row">
            {lineChartPoints.map((point) => (
              <div key={point.period} className="dashboard-line-label-item">
                <Typography.Text>{point.label}</Typography.Text>
                <Typography.Text strong>{formatCurrency(point.value)}</Typography.Text>
              </div>
            ))}
          </div>
        </div>
        </Card>
      ) : null}

      <Card
        className="page-card"
        loading={loading}
        title={
          <Space>
            <BarChartOutlined />
            <span>Hóa đơn cập nhật gần đây</span>
          </Space>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={overview?.recentInvoices ?? []}
          pagination={false}
          scroll={{ x: 860 }}
        />
      </Card>
    </Space>
  )
}
