import { Button, Card, Form, Input, Space, Table, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/axios.instance'
import type { PagedResponse, UserActionLogItem } from '../types'

type SearchValues = {
  keyword?: string
  moduleKey?: string
  action?: string
}

export function UserActionLogsPage() {
  const [form] = Form.useForm<SearchValues>()
  const [items, setItems] = useState<UserActionLogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<SearchValues>({})

  const fetchData = async (
    nextPage = page,
    nextLimit = limit,
    nextFilters: SearchValues = filters,
  ) => {
    setLoading(true)
    try {
      const response = await apiClient.get<PagedResponse<UserActionLogItem>>('/user-action-logs', {
        params: {
          page: nextPage,
          limit: nextLimit,
          keyword: nextFilters.keyword?.trim() || undefined,
          moduleKey: nextFilters.moduleKey?.trim() || undefined,
          action: nextFilters.action?.trim() || undefined,
        },
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

  useEffect(() => {
    void fetchData(1, limit, {})
  }, [])

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

  const columns = useMemo(
    () => [
      {
        title: 'Thời gian',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (value: string) => new Date(value).toLocaleString('vi-VN'),
      },
      {
        title: 'Người dùng',
        key: 'user',
        width: 230,
        render: (_: unknown, item: UserActionLogItem) => (
          <div>
            <Typography.Text strong>{item.hoVaTen ?? 'Ẩn danh'}</Typography.Text>
            <div>
              <Typography.Text type="secondary">{item.taiKhoan ?? '-'}</Typography.Text>
            </div>
          </div>
        ),
      },
      {
        title: 'Vai trò',
        dataIndex: 'roleCode',
        key: 'roleCode',
        width: 130,
        render: (value: string | null) => value ?? '-',
      },
      {
        title: 'Hành động',
        dataIndex: 'action',
        key: 'action',
        width: 170,
        render: (value: string) => <Tag color="blue">{value}</Tag>,
      },
      {
        title: 'Module',
        dataIndex: 'moduleKey',
        key: 'moduleKey',
        width: 130,
        render: (value: string | null) => value ?? '-',
      },
      {
        title: 'API',
        key: 'endpoint',
        width: 240,
        render: (_: unknown, item: UserActionLogItem) => (
          <Typography.Text>
            [{item.httpMethod}] {item.endpoint}
          </Typography.Text>
        ),
      },
      {
        title: 'Trạng thái',
        dataIndex: 'statusCode',
        key: 'statusCode',
        width: 110,
        render: (value: number) => {
          const color = value >= 400 ? 'red' : 'green'
          return <Tag color={color}>{value}</Tag>
        },
      },
      {
        title: 'IP',
        dataIndex: 'ipAddress',
        key: 'ipAddress',
        width: 140,
        render: (value: string | null) => value ?? '-',
      },
      {
        title: 'Dữ liệu gửi',
        dataIndex: 'requestData',
        key: 'requestData',
        width: 280,
        render: (value: unknown) => {
          if (!value) {
            return '-'
          }

          const raw = JSON.stringify(value)
          const shortText = raw.length > 120 ? `${raw.slice(0, 120)}...` : raw
          return <Typography.Text code>{shortText}</Typography.Text>
        },
      },
      {
        title: 'Lỗi',
        dataIndex: 'errorMessage',
        key: 'errorMessage',
        width: 220,
        render: (value: string | null) => value ?? '-',
      },
    ],
    [],
  )

  return (
    <Card className="page-card" title={<Typography.Title level={5}>Nhật ký thao tác người dùng</Typography.Title>}>
      <Form form={form} layout="inline" style={{ marginBottom: 16, rowGap: 8 }}>
        <Form.Item name="keyword">
          <Input allowClear placeholder="Tìm theo tài khoản, họ tên, endpoint..." style={{ width: 320 }} />
        </Form.Item>
        <Form.Item name="moduleKey">
          <Input allowClear placeholder="Module (users, invoices...)" style={{ width: 220 }} />
        </Form.Item>
        <Form.Item name="action">
          <Input allowClear placeholder="Hành động (VD: UPDATE_USERS)" style={{ width: 240 }} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" onClick={() => void onSearch()}>
              Tìm kiếm
            </Button>
            <Button onClick={onReset}>Đặt lại</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table<UserActionLogItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={items}
        scroll={{ x: 1800 }}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          onChange: (nextPage, nextPageSize) => {
            void fetchData(nextPage, nextPageSize, filters)
          },
        }}
      />
    </Card>
  )
}
