import {
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Row,
  Select,
  Space,
  Statistic,
  Skeleton,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  AlertOutlined,
  FilterOutlined,
  HistoryOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/axios.instance'
import type { DebtSummaryItem, DebtSummaryResponse, PagedResponse, RouteItem } from '../types'

// Re-use from households-page logic (inline here for independence)
function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function debtSeverityBadge(overdueCount: number, unpaidCount: number) {
  if (overdueCount >= 3) {
    return (
      <Tooltip title={`${overdueCount} kỳ quá hạn`}>
        <Tag
          color="red"
          icon={<AlertOutlined />}
          style={{ fontWeight: 700 }}
          className="debt-badge-critical"
        >
          Nghiêm trọng
        </Tag>
      </Tooltip>
    )
  }
  if (overdueCount >= 1) {
    return (
      <Tooltip title={`${overdueCount} kỳ quá hạn, ${unpaidCount} kỳ chưa thu`}>
        <Tag
          color="orange"
          icon={<WarningOutlined />}
          className="debt-badge-warning"
        >
          Cảnh báo
        </Tag>
      </Tooltip>
    )
  }
  return (
    <Tooltip title={`${unpaidCount} kỳ chưa thu`}>
      <Tag color="gold" className="debt-badge-mild">
        Nhẹ
      </Tag>
    </Tooltip>
  )
}

type FilterValues = {
  routeId?: number
  minDebt?: number
  minOverduePeriods?: number
}

// HouseholdHistoryModal import-like inline reference — we use a prop callback pattern
interface DebtManagementPageProps {
  onViewHistory?: (householdId: number) => void
}

export function DebtManagementPage({ onViewHistory }: DebtManagementPageProps) {
  const [form] = Form.useForm<FilterValues>()
  const [data, setData] = useState<DebtSummaryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [routes, setRoutes] = useState<RouteItem[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<FilterValues>({})

  const routeOptions = useMemo(
    () =>
      routes.map((r) => ({
        value: r.id,
        label: `${r.tenTuyen} (${r.maTuyen})`,
      })),
    [routes],
  )

  const fetchRoutes = async () => {
    try {
      const res = await apiClient.get<PagedResponse<RouteItem>>('/routes', {
        params: { page: 1, limit: 1000 },
      })
      setRoutes(res.data.data)
    } catch {
      // non-critical
    }
  }

  const fetchDebt = async (
    nextPage = page,
    nextLimit = limit,
    nextFilters: FilterValues = filters,
  ) => {
    setLoading(true)
    try {
      const res = await apiClient.get<DebtSummaryResponse>('/invoices/debt-summary', {
        params: {
          page: nextPage,
          limit: nextLimit,
          routeId: nextFilters.routeId,
          minDebt: nextFilters.minDebt,
          minOverduePeriods: nextFilters.minOverduePeriods,
        },
      })
      setData(res.data.data)
      setPage(res.data.pagination.page)
      setLimit(res.data.pagination.limit)
      setTotal(res.data.pagination.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được dữ liệu công nợ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchRoutes()
    void fetchDebt(1, 20, {})
  }, [])

  const onSearch = async () => {
    const values = form.getFieldsValue()
    setFilters(values)
    void fetchDebt(1, limit, values)
  }

  const onReset = () => {
    form.resetFields()
    const cleared: FilterValues = {}
    setFilters(cleared)
    void fetchDebt(1, limit, cleared)
  }

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalDebtAmount = data.reduce((s, r) => s + r.totalDebt, 0)
    const criticalCount = data.filter((r) => r.overdueCount >= 3).length
    const warningCount = data.filter((r) => r.overdueCount >= 1 && r.overdueCount < 3).length
    return { totalDebtAmount, criticalCount, warningCount }
  }, [data])

  const columns = [
    {
      title: 'Mức độ',
      key: 'severity',
      width: 130,
      render: (_: unknown, record: DebtSummaryItem) =>
        debtSeverityBadge(record.overdueCount, record.unpaidCount),
    },
    {
      title: 'Mã KH',
      dataIndex: 'maHoDan',
      width: 110,
    },
    {
      title: 'Họ tên chủ hộ',
      dataIndex: 'tenChuHo',
      width: 180,
      render: (val: string, record: DebtSummaryItem) => (
        <div>
          <Typography.Text strong>{val}</Typography.Text>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {record.diaChi}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Tuyến thu',
      key: 'route',
      width: 160,
      render: (_: unknown, record: DebtSummaryItem) =>
        record.tuyenThuRac
          ? `${record.tuyenThuRac.tenTuyen} (${record.tuyenThuRac.maTuyen})`
          : '-',
    },
    {
      title: 'Kỳ OVERDUE',
      dataIndex: 'overdueCount',
      width: 120,
      sorter: (a: DebtSummaryItem, b: DebtSummaryItem) => a.overdueCount - b.overdueCount,
      render: (val: number) => (
        <Tag color={val >= 3 ? 'red' : val >= 1 ? 'orange' : 'default'}>{val} kỳ</Tag>
      ),
    },
    {
      title: 'Kỳ UNPAID',
      dataIndex: 'unpaidCount',
      width: 110,
      sorter: (a: DebtSummaryItem, b: DebtSummaryItem) => a.unpaidCount - b.unpaidCount,
      render: (val: number) => <Tag color="gold">{val} kỳ</Tag>,
    },
    {
      title: 'Tổng nợ',
      dataIndex: 'totalDebt',
      width: 150,
      sorter: (a: DebtSummaryItem, b: DebtSummaryItem) => a.totalDebt - b.totalDebt,
      defaultSortOrder: 'descend' as const,
      render: (val: number) => (
        <Typography.Text strong style={{ color: '#cf1322' }}>
          {formatCurrency(val)}
        </Typography.Text>
      ),
    },
    {
      title: 'Thu lần cuối',
      dataIndex: 'lastPaidAt',
      width: 140,
      render: (val: string | null) =>
        val
          ? new Date(val).toLocaleDateString('vi-VN')
          : <Typography.Text type="secondary">Chưa có</Typography.Text>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 110,
      fixed: 'right' as const,
      render: (_: unknown, record: DebtSummaryItem) => (
        <Button
          size="small"
          icon={<HistoryOutlined />}
          onClick={() => onViewHistory?.(record.householdId)}
        >
          Lịch sử
        </Button>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* Summary KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="page-card">
            <Statistic
              title="Tổng hộ đang nợ (trang này)"
              value={data.length}
              suffix={`/ ${total} tổng`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="page-card">
            <Statistic
              title="Tổng tiền nợ (trang này)"
              value={summaryStats.totalDebtAmount}
              formatter={(val) => formatCurrency(Number(val))}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="page-card">
            <Statistic
              title="Nghiêm trọng (≥3 kỳ quá hạn)"
              value={summaryStats.criticalCount}
              valueStyle={{ color: summaryStats.criticalCount > 0 ? '#ff4d4f' : '#52c41a' }}
              suffix={`/ ${summaryStats.warningCount} cảnh báo`}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Card */}
      <Card
        className="page-card"
        title={
          <Space>
            <AlertOutlined />
            <Typography.Title level={5} style={{ margin: 0 }}>
              Quản lý công nợ
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontWeight: 400, fontSize: 13 }}>
              — Danh sách hộ dân chưa thanh toán / quá hạn
            </Typography.Text>
          </Space>
        }
      >
        {/* Filters */}
        <Form form={form} layout="inline" style={{ marginBottom: 16, rowGap: 8, flexWrap: 'wrap' }}>
          <Form.Item name="routeId" label="Tuyến thu">
            <Select
              allowClear
              placeholder="Tất cả tuyến"
              style={{ width: 220 }}
              options={routeOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="minDebt" label="Nợ tối thiểu (VNĐ)">
            <InputNumber
              min={0}
              step={100000}
              style={{ width: 160 }}
              formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(val) => (Number(val?.replace(/,/g, '') ?? 0) as unknown as 0)}
              placeholder="VD: 500000"
            />
          </Form.Item>
          <Form.Item name="minOverduePeriods" label="Kỳ quá hạn tối thiểu">
            <InputNumber min={0} max={100} style={{ width: 140 }} placeholder="VD: 1" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<FilterOutlined />} onClick={() => void onSearch()}>
                Lọc
              </Button>
              <Button icon={<ReloadOutlined />} onClick={onReset}>
                Đặt lại
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <Table<DebtSummaryItem>
          rowKey="householdId"
          loading={loading}
          columns={columns}
          dataSource={data}
          scroll={{ x: 1100 }}
          rowClassName={(record) =>
            record.overdueCount >= 3
              ? 'debt-row-critical'
              : record.overdueCount >= 1
                ? 'debt-row-warning'
                : ''
          }
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (tot) => `Tổng ${tot} hộ đang nợ`,
            onChange: (nextPage, nextPageSize) => {
              void fetchDebt(nextPage, nextPageSize, filters)
            },
          }}
        />
      </Card>
    </Space>
  )
}
