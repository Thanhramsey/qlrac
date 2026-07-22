import {
  Badge,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { SearchOutlined, ReloadOutlined, FileTextOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/axios.instance'
import { useDebounce } from '../hooks/use-debounce'
import type { PagedResponse, UserActionLogItem } from '../types'

const { RangePicker } = DatePicker

type SearchValues = {
  keyword?: string
  moduleKey?: string
  action?: string
  statusCategory?: 'success' | 'client_error' | 'server_error'
  httpMethod?: string
  dateRange?: [Dayjs, Dayjs]
}

// Action badge color mapping
function actionBadge(action: string) {
  const upper = action.toUpperCase()
  if (upper.includes('CREATE') || upper.includes('LOGIN') || upper.includes('IMPORT')) {
    return { status: 'success' as const, color: '#52c41a' }
  }
  if (upper.includes('UPDATE') || upper.includes('PATCH') || upper.includes('RESTORE')) {
    return { status: 'processing' as const, color: '#1677ff' }
  }
  if (upper.includes('DELETE') || upper.includes('LOGOUT')) {
    return { status: 'error' as const, color: '#ff4d4f' }
  }
  if (upper.includes('PUBLISH') || upper.includes('EXPORT')) {
    return { status: 'warning' as const, color: '#faad14' }
  }
  return { status: 'default' as const, color: '#d9d9d9' }
}

function statusCodeTag(code: number) {
  if (code >= 500) return <Tag color="red">{code}</Tag>
  if (code >= 400) return <Tag color="orange">{code}</Tag>
  return <Tag color="green">{code}</Tag>
}

function httpMethodTag(method: string) {
  const colors: Record<string, string> = {
    GET: 'blue',
    POST: 'green',
    PATCH: 'orange',
    PUT: 'orange',
    DELETE: 'red',
  }
  return <Tag color={colors[method] ?? 'default'}>{method}</Tag>
}

// Detail Modal
function LogDetailModal({
  item,
  onClose,
}: {
  item: UserActionLogItem | null
  onClose: () => void
}) {
  if (!item) return null

  const prettyJson = (data: unknown) => {
    if (!data) return '-'
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  const { status, color } = actionBadge(item.action)

  return (
    <Modal
      open={!!item}
      onCancel={onClose}
      footer={null}
      width={700}
      title={
        <Space>
          <FileTextOutlined />
          <span>Chi tiết nhật ký thao tác</span>
          <Badge status={status} text={item.action} />
        </Space>
      }
      destroyOnClose
    >
      <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Thời gian" span={2}>
          {new Date(item.createdAt).toLocaleString('vi-VN')}
        </Descriptions.Item>
        <Descriptions.Item label="Người dùng">
          {item.hoVaTen ?? 'Ẩn danh'} ({item.taiKhoan ?? '-'})
        </Descriptions.Item>
        <Descriptions.Item label="Vai trò">{item.roleCode ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Hành động">
          <Tag color={color}>{item.action}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Module">{item.moduleKey ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Phương thức">{httpMethodTag(item.httpMethod)}</Descriptions.Item>
        <Descriptions.Item label="Trạng thái">{statusCodeTag(item.statusCode)}</Descriptions.Item>
        <Descriptions.Item label="Endpoint" span={2}>
          <Typography.Text code copyable>
            [{item.httpMethod}] {item.endpoint}
          </Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="IP">{item.ipAddress ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="User Agent">
          <Typography.Text style={{ fontSize: 11 }}>{item.userAgent ?? '-'}</Typography.Text>
        </Descriptions.Item>
      </Descriptions>

      {item.requestData && (
        <div style={{ marginBottom: 12 }}>
          <Typography.Text strong>Dữ liệu gửi (requestData):</Typography.Text>
          <pre
            style={{
              marginTop: 6,
              padding: '10px 14px',
              borderRadius: 8,
              background: '#0d1117',
              color: '#c9d1d9',
              fontSize: 12,
              overflowX: 'auto',
              maxHeight: 240,
              lineHeight: 1.5,
            }}
          >
            {prettyJson(item.requestData)}
          </pre>
        </div>
      )}

      {item.errorMessage && (
        <div>
          <Typography.Text strong type="danger">
            Thông báo lỗi:
          </Typography.Text>
          <pre
            style={{
              marginTop: 6,
              padding: '10px 14px',
              borderRadius: 8,
              background: '#fff1f0',
              border: '1px solid #ffccc7',
              color: '#cf1322',
              fontSize: 12,
              overflowX: 'auto',
              maxHeight: 160,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {item.errorMessage}
          </pre>
        </div>
      )}
    </Modal>
  )
}

export function UserActionLogsPage() {
  const [form] = Form.useForm<SearchValues>()
  const [items, setItems] = useState<UserActionLogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<SearchValues>({})
  const [selectedItem, setSelectedItem] = useState<UserActionLogItem | null>(null)

  const fetchData = async (
    nextPage = page,
    nextLimit = limit,
    nextFilters: SearchValues = filters,
  ) => {
    setLoading(true)
    try {
      const dateRange = nextFilters.dateRange
      const params: Record<string, unknown> = {
        page: nextPage,
        limit: nextLimit,
        keyword: nextFilters.keyword?.trim() || undefined,
        moduleKey: nextFilters.moduleKey?.trim() || undefined,
        action: nextFilters.action?.trim() || undefined,
        httpMethod: nextFilters.httpMethod || undefined,
      }

      if (nextFilters.statusCategory === 'success') {
        params.statusCodeMin = 200
        params.statusCodeMax = 399
      } else if (nextFilters.statusCategory === 'client_error') {
        params.statusCodeMin = 400
        params.statusCodeMax = 499
      } else if (nextFilters.statusCategory === 'server_error') {
        params.statusCodeMin = 500
        params.statusCodeMax = 599
      }

      if (dateRange?.[0]) params.fromDate = dateRange[0].format('YYYY-MM-DD')
      if (dateRange?.[1]) params.toDate = dateRange[1].format('YYYY-MM-DD')

      const response = await apiClient.get<PagedResponse<UserActionLogItem>>('/user-action-logs', {
        params,
      })

      setItems(response.data.data)
      setPage(response.data.pagination.page)
      setLimit(response.data.pagination.limit)
      setTotal(response.data.pagination.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được nhật ký thao tác')
    } finally {
      setLoading(false)
    }
  }

  const [keywordInput, setKeywordInput] = useState('')
  const [moduleKeyInput, setModuleKeyInput] = useState('')
  const [actionInput, setActionInput] = useState('')
  const debouncedKeyword = useDebounce(keywordInput, 400)
  const debouncedModuleKey = useDebounce(moduleKeyInput, 400)
  const debouncedAction = useDebounce(actionInput, 400)

  useEffect(() => {
    const nextFilters: SearchValues = {
      ...filters,
      keyword: debouncedKeyword.trim() || undefined,
      moduleKey: debouncedModuleKey.trim() || undefined,
      action: debouncedAction.trim() || undefined,
    }
    void fetchData(1, limit, nextFilters)
  }, [debouncedKeyword, debouncedModuleKey, debouncedAction])

  const onSearch = async () => {
    const values = await form.validateFields()
    setFilters(values)
    void fetchData(1, limit, values)
  }

  const onReset = () => {
    form.resetFields()
    const cleared: SearchValues = {}
    setFilters(cleared)
    void fetchData(1, limit, cleared)
  }

  // Summary stats from current page
  const summaryStats = useMemo(() => {
    const errors = items.filter((i) => i.statusCode >= 400).length
    const success = items.filter((i) => i.statusCode < 400).length
    return { errors, success, total: items.length }
  }, [items])

  const columns = useMemo(
    () => [
      {
        title: 'Thời gian',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 170,
        render: (value: string) => new Date(value).toLocaleString('vi-VN'),
      },
      {
        title: 'Người dùng',
        key: 'user',
        width: 200,
        render: (_: unknown, item: UserActionLogItem) => (
          <div>
            <Typography.Text strong>{item.hoVaTen ?? 'Ẩn danh'}</Typography.Text>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {item.taiKhoan ?? '-'} · {item.roleCode ?? '-'}
              </Typography.Text>
            </div>
          </div>
        ),
      },
      {
        title: 'Hành động',
        dataIndex: 'action',
        key: 'action',
        width: 200,
        render: (value: string) => {
          const { status, color } = actionBadge(value)
          return (
            <Space size={4}>
              <Badge status={status} />
              <Tag color={color} style={{ margin: 0 }}>
                {value}
              </Tag>
            </Space>
          )
        },
      },
      {
        title: 'Module',
        dataIndex: 'moduleKey',
        key: 'moduleKey',
        width: 120,
        render: (value: string | null) =>
          value ? <Tag color="geekblue">{value}</Tag> : '-',
      },
      {
        title: 'API',
        key: 'endpoint',
        width: 260,
        render: (_: unknown, item: UserActionLogItem) => (
          <Space size={4}>
            {httpMethodTag(item.httpMethod)}
            <Typography.Text style={{ fontSize: 12 }}>{item.endpoint}</Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Trạng thái',
        dataIndex: 'statusCode',
        key: 'statusCode',
        width: 100,
        render: (value: number) => statusCodeTag(value),
      },
      {
        title: 'IP',
        dataIndex: 'ipAddress',
        key: 'ipAddress',
        width: 130,
        render: (value: string | null) => (
          <Typography.Text style={{ fontSize: 12 }}>{value ?? '-'}</Typography.Text>
        ),
      },
      {
        title: 'Lỗi',
        dataIndex: 'errorMessage',
        key: 'errorMessage',
        width: 200,
        render: (value: string | null) =>
          value ? (
            <Typography.Text type="danger" style={{ fontSize: 12 }}>
              {value.length > 60 ? `${value.slice(0, 60)}...` : value}
            </Typography.Text>
          ) : (
            '-'
          ),
      },
    ],
    [],
  )

  return (
    <Card
      className="page-card"
      title={<Typography.Title level={5}>Nhật ký thao tác người dùng</Typography.Title>}
    >
      {/* Summary bar */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 12,
          padding: '8px 12px',
          borderRadius: 8,
          background: 'rgba(22, 119, 255, 0.04)',
          border: '1px solid rgba(22, 119, 255, 0.1)',
          flexWrap: 'wrap',
        }}
      >
        <Typography.Text>
          Trang hiện tại:{' '}
          <Typography.Text strong>{summaryStats.total}</Typography.Text> bản ghi
        </Typography.Text>
        <Typography.Text>
          ✅ Thành công:{' '}
          <Typography.Text strong style={{ color: '#52c41a' }}>
            {summaryStats.success}
          </Typography.Text>
        </Typography.Text>
        <Typography.Text>
          ❌ Lỗi:{' '}
          <Typography.Text strong style={{ color: '#ff4d4f' }}>
            {summaryStats.errors}
          </Typography.Text>
        </Typography.Text>
        <Typography.Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
          Click vào hàng để xem chi tiết
        </Typography.Text>
      </div>

      {/* Filters */}
      <Form form={form} layout="inline" style={{ marginBottom: 16, rowGap: 8, flexWrap: 'wrap' }}>
        <Form.Item name="keyword">
          <Input
            allowClear
            placeholder="Tài khoản, họ tên, endpoint..."
            style={{ width: 260 }}
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
          />
        </Form.Item>
        <Form.Item name="moduleKey">
          <Input
            allowClear
            placeholder="Module (users, invoices...)"
            style={{ width: 200 }}
            value={moduleKeyInput}
            onChange={(e) => setModuleKeyInput(e.target.value)}
          />
        </Form.Item>
        <Form.Item name="action">
          <Input
            allowClear
            placeholder="Hành động (CREATE_USERS...)"
            style={{ width: 210 }}
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
          />
        </Form.Item>
        <Form.Item name="httpMethod">
          <Select
            allowClear
            placeholder="Phương thức"
            style={{ width: 130 }}
            options={[
              { value: 'GET', label: 'GET' },
              { value: 'POST', label: 'POST' },
              { value: 'PATCH', label: 'PATCH' },
              { value: 'PUT', label: 'PUT' },
              { value: 'DELETE', label: 'DELETE' },
            ]}
          />
        </Form.Item>
        <Form.Item name="statusCategory">
          <Select
            allowClear
            placeholder="Trạng thái HTTP"
            style={{ width: 160 }}
            options={[
              { value: 'success', label: '✅ Thành công (2xx/3xx)' },
              { value: 'client_error', label: '⚠️ Lỗi client (4xx)' },
              { value: 'server_error', label: '❌ Lỗi server (5xx)' },
            ]}
          />
        </Form.Item>
        <Form.Item name="dateRange">
          <RangePicker
            format="DD/MM/YYYY"
            placeholder={['Từ ngày', 'Đến ngày']}
            style={{ width: 240 }}
          />
        </Form.Item>
        <Form.Item>
          <Button icon={<ReloadOutlined />} onClick={onReset}>
            Đặt lại
          </Button>
        </Form.Item>
      </Form>

      {loading && items.length === 0 ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <Table<UserActionLogItem>
          rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={items}
        scroll={{ x: 1600 }}
        onRow={(record) => ({
          onClick: () => setSelectedItem(record),
          style: { cursor: 'pointer' },
        })}
        rowClassName={(record) =>
          record.statusCode >= 500
            ? 'log-row-error'
            : record.statusCode >= 400
              ? 'log-row-warning'
              : ''
        }
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (tot) => `Tổng ${tot} bản ghi nhật ký`,
          onChange: (nextPage, nextPageSize) => {
            void fetchData(nextPage, nextPageSize, filters)
          },
        }}
      />
      )}

      <LogDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </Card>
  )
}
