import { Badge, Button, Card, Col, Progress, Row, Select, Space, Statistic, Tag, Tooltip, Typography, message } from 'antd'
import { BarChartOutlined, ClockCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiClient } from '../api/axios.instance'
import type { BillingPeriodItem, DashboardOverviewResponse } from '../types'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function statusColor(status: 'PAID' | 'UNPAID' | 'OVERDUE' | 'PUBLISHED') {
  if (status === 'PUBLISHED') return 'processing'
  if (status === 'PAID') return 'success'
  if (status === 'OVERDUE') return 'error'
  return 'warning'
}

const DONUT_COLORS: Record<string, string> = {
  PAID: '#52c41a',
  PUBLISHED: '#1677ff',
  UNPAID: '#faad14',
  OVERDUE: '#ff4d4f',
}

const AUTO_REFRESH_SECONDS = 60

interface DonutChartProps {
  data: Array<{ key: string; label: string; count: number }>
}

function DonutChart({ data }: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0)
  const cx = 80
  const cy = 80
  const r = 60
  const innerR = 38

  let currentAngle = -Math.PI / 2

  const slices = data.map((item) => {
    const fraction = total > 0 ? item.count / total : 0
    const startAngle = currentAngle
    const endAngle = startAngle + fraction * 2 * Math.PI
    currentAngle = endAngle

    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const ix1 = cx + innerR * Math.cos(endAngle)
    const iy1 = cy + innerR * Math.sin(endAngle)
    const ix2 = cx + innerR * Math.cos(startAngle)
    const iy2 = cy + innerR * Math.sin(startAngle)

    const largeArc = fraction > 0.5 ? 1 : 0
    const path =
      fraction === 0
        ? ''
        : `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`

    const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
    return { ...item, path, pct, color: DONUT_COLORS[item.key] ?? '#d9d9d9' }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={160} height={160} viewBox="0 0 160 160">
          {total === 0 ? (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e8e8e8" strokeWidth={r - innerR} />
          ) : (
            slices.map((slice) =>
              slice.path ? (
                <Tooltip
                  key={slice.key}
                  title={`${slice.label}: ${slice.count} (${slice.pct}%)`}
                >
                  <path
                    d={slice.path}
                    fill={slice.color}
                    stroke="#fff"
                    strokeWidth={2}
                    style={{ cursor: 'pointer', transition: 'opacity 0.2s', opacity: 0.92 }}
                    onMouseEnter={(e) => ((e.target as SVGPathElement).style.opacity = '1')}
                    onMouseLeave={(e) => ((e.target as SVGPathElement).style.opacity = '0.92')}
                  />
                </Tooltip>
              ) : null,
            )
          )}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize={13} fill="#888">
            Tổng
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize={18} fontWeight={700} fill="#333">
            {total}
          </text>
        </svg>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 140 }}>
        {slices.map((slice) => (
          <div key={slice.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: slice.color,
                flexShrink: 0,
              }}
            />
            <Typography.Text style={{ flex: 1, fontSize: 13 }}>{slice.label}</Typography.Text>
            <Tag color={statusColor(slice.key as 'PAID' | 'UNPAID' | 'OVERDUE' | 'PUBLISHED')}>
              {slice.count}
            </Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12, width: 36, textAlign: 'right' }}>
              {slice.pct}%
            </Typography.Text>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const [loading, setLoading] = useState(false)
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null)
  const [billingPeriods, setBillingPeriods] = useState<BillingPeriodItem[]>([])
  const [selectedKyHoaDons, setSelectedKyHoaDons] = useState<string[]>([])
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  const resetCountdown = () => {
    setCountdown(AUTO_REFRESH_SECONDS)
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
    }
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void loadOverview()
          return AUTO_REFRESH_SECONDS
        }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => {
    void (async () => {
      await loadBillingPeriods()
    })()
  }, [])

  useEffect(() => {
    void loadOverview()
    resetCountdown()
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [selectedKyHoaDons])

  const handleManualRefresh = () => {
    void loadOverview()
    resetCountdown()
  }

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
    if (lineChartPoints.length === 0) return ''
    return lineChartPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ')
  }, [lineChartPoints])

  const revenueTicks = useMemo(
    () => [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxPaidRevenue * ratio)),
    [maxPaidRevenue],
  )

  const shouldShowLineChart = (overview?.invoiceTrendChart?.length ?? 0) >= 2

  // Derived KPIs
  const collectionRate = useMemo(() => {
    const total = overview?.summary.totalInvoices ?? 0
    const paid = overview?.summary.paidInvoices ?? 0
    return total > 0 ? Math.round((paid / total) * 100) : 0
  }, [overview])

  const avgRevenuePerPeriod = useMemo(() => {
    const trend = overview?.invoiceTrendChart ?? []
    if (trend.length === 0) return 0
    const totalPaid = trend.reduce((sum, item) => sum + item.paidRevenue, 0)
    return Math.round(totalPaid / trend.length)
  }, [overview])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* Header Card */}
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
              onClick={handleManualRefresh}
            >
              Làm mới
            </Button>
            <Space size={4}>
              <ClockCircleOutlined style={{ color: '#1677ff' }} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Tự động cập nhật sau{' '}
                <Badge
                  count={countdown}
                  style={{ backgroundColor: countdown <= 10 ? '#ff4d4f' : '#1677ff' }}
                  overflowCount={999}
                />
                s
              </Typography.Text>
            </Space>
          </Space>
        </Space>

        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          {selectedKyHoaDons.length > 0
            ? `Đang xem dữ liệu cho ${selectedKyHoaDons.length} kỳ đã chọn.`
            : 'Đang xem dữ liệu tổng hợp tất cả các kỳ hóa đơn.'}
        </Typography.Paragraph>
      </Card>

      {/* KPI Row */}
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

      {/* New KPI Row – Collection rate + Avg revenue */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card
            className="page-card"
            loading={loading}
            title="Tỉ lệ thu thành công"
            style={{ height: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Typography.Title level={2} style={{ margin: 0, color: collectionRate >= 80 ? '#52c41a' : collectionRate >= 50 ? '#faad14' : '#ff4d4f' }}>
                {collectionRate}%
              </Typography.Title>
              <Progress
                percent={collectionRate}
                strokeColor={collectionRate >= 80 ? '#52c41a' : collectionRate >= 50 ? '#faad14' : '#ff4d4f'}
                showInfo={false}
                strokeWidth={12}
                style={{ margin: 0 }}
              />
              <Typography.Text type="secondary">
                {overview?.summary.paidInvoices ?? 0} / {overview?.summary.totalInvoices ?? 0} hóa đơn đã thu
              </Typography.Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card
            className="page-card"
            loading={loading}
            title="Trung bình doanh thu / kỳ"
            style={{ height: '100%' }}
          >
            <Typography.Title level={2} style={{ margin: 0, color: '#1677ff' }}>
              {formatCurrency(avgRevenuePerPeriod)}
            </Typography.Title>
            <Typography.Text type="secondary">
              Tính trên {overview?.invoiceTrendChart?.length ?? 0} kỳ hóa đơn
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
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
            <DonutChart data={overview?.invoiceStatusChart ?? []} />
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

      {/* Staff Progress */}
      <Card
        className="page-card"
        loading={loading}
        title={
          <Space>
            <BarChartOutlined />
            <span>Tiến trình thu gom của nhân viên</span>
          </Space>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(overview?.staffProgress ?? []).length === 0 ? (
            <Typography.Text type="secondary">Không có dữ liệu tiến trình thu gom</Typography.Text>
          ) : (
            (overview?.staffProgress ?? []).map((item) => (
              <div key={item.staffId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography.Text strong>{item.staffName}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Đã thu: <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{item.paidCount}</span> / Chưa thu:{' '}
                    <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{item.unpaidCount}</span> (Tổng: {item.totalCount} hộ)
                  </Typography.Text>
                </div>
                <div
                  style={{
                    height: 24,
                    width: '100%',
                    backgroundColor: '#f5f5f5',
                    borderRadius: 12,
                    overflow: 'hidden',
                    display: 'flex',
                  }}
                >
                  {item.paidPercentage > 0 && (
                    <Tooltip title={`Đã thu: ${item.paidCount}/${item.totalCount} hộ (${item.paidPercentage}%)`}>
                      <div
                        style={{
                          width: `${item.paidPercentage}%`,
                          backgroundColor: '#52c41a',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 'bold',
                          transition: 'width 0.3s ease',
                        }}
                      >
                        {item.paidPercentage >= 10 ? `${item.paidPercentage}%` : ''}
                      </div>
                    </Tooltip>
                  )}
                  {item.unpaidPercentage > 0 && (
                    <Tooltip title={`Chưa thu: ${item.unpaidCount}/${item.totalCount} hộ (${item.unpaidPercentage}%)`}>
                      <div
                        style={{
                          width: `${item.unpaidPercentage}%`,
                          backgroundColor: '#ff4d4f',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 'bold',
                          transition: 'width 0.3s ease',
                        }}
                      >
                        {item.unpaidPercentage >= 10 ? `${item.unpaidPercentage}%` : ''}
                      </div>
                    </Tooltip>
                  )}
                  {item.totalCount === 0 && (
                    <div
                      style={{
                        width: '100%',
                        backgroundColor: '#d9d9d9',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#595959',
                        fontSize: 11,
                      }}
                    >
                      Chưa giao tuyến / Không có hóa đơn
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </Space>
  )
}
