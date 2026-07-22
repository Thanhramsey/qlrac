import {
  Avatar,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/axios.instance'
import { useDebounce } from '../hooks/use-debounce'
import type { PagedResponse, RoleOption, RouteItem, UserListItem, UserListResponse } from '../types'

interface UsersPageProps {
  roles: RoleOption[]
}

type UserFormValues = {
  taiKhoan: string
  hoVaTen: string
  ngaySinh?: dayjs.Dayjs
  gioiTinh?: string
  soDienThoai: string
  soGiayTo: string
  diaChi?: string
  email?: string
  role: string
  routeIds?: number[]
  isActive: boolean
  matKhau?: string
}

export function UsersPage({ roles }: UsersPageProps) {
  const [form] = Form.useForm<UserFormValues>()
  const [listData, setListData] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const debouncedSearch = useDebounce(searchKeyword, 400)

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  })
  const [routeOptions, setRouteOptions] = useState<RouteItem[]>([])
  const [includeInactive, setIncludeInactive] = useState(false)

  const roleLabelMap = useMemo(
    () => Object.fromEntries(roles.map((item) => [item.code, item.label])),
    [roles],
  )

  const fetchUsers = async (
    page = pagination.page,
    limit = pagination.limit,
    keyword = debouncedSearch,
  ) => {
    setLoading(true)
    try {
      const response = await apiClient.get<UserListResponse>('/users', {
        params: {
          page,
          limit,
          includeInactive,
          keyword: keyword.trim() || undefined,
        },
      })
      setListData(response.data.data)
      setPagination({
        page: response.data.pagination.page,
        limit: response.data.pagination.limit,
        total: response.data.pagination.total,
      })
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : 'Không tải được danh sách người dùng',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchUsers(1, pagination.limit, debouncedSearch)
    void fetchRoutes()
  }, [includeInactive, debouncedSearch])

  const fetchRoutes = async () => {
    try {
      const response = await apiClient.get<PagedResponse<RouteItem>>('/routes', {
        params: { page: 1, limit: 1000 },
      })
      setRouteOptions(response.data.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách tuyến đường')
    }
  }

  const openCreateModal = () => {
    setEditingUser(null)
    setModalOpen(true)
    form.resetFields()
    form.setFieldsValue({
      role: roles[0]?.code ?? 'STAFF',
      isActive: true,
    })
  }

  const openEditModal = (user: UserListItem) => {
    setEditingUser(user)
    setModalOpen(true)
    form.setFieldsValue({
      taiKhoan: user.taiKhoan,
      hoVaTen: user.hoVaTen,
      ngaySinh: user.ngaySinh ? dayjs(user.ngaySinh) : undefined,
      gioiTinh: user.gioiTinh ?? undefined,
      soDienThoai: user.soDienThoai,
      soGiayTo: user.soGiayTo,
      diaChi: user.diaChi ?? undefined,
      email: user.email ?? undefined,
      role: user.role,
      routeIds: user.routeIds ?? user.assignedRoutes?.map((item) => item.id) ?? [],
      isActive: user.isActive,
      matKhau: undefined,
    })
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingUser(null)
    form.resetFields()
  }

  const onSaveUser = async () => {
    try {
      const values = await form.validateFields()

      const payload = {
        ...values,
        ngaySinh: values.ngaySinh ? values.ngaySinh.format('YYYY-MM-DD') : undefined,
        routeIds: values.routeIds ?? [],
      }

      if (editingUser) {
        if (!payload.matKhau) {
          delete payload.matKhau
        }

        await apiClient.patch(`/users/${editingUser.id}`, payload)
        message.success('Cập nhật người dùng thành công')
      } else {
        await apiClient.post('/users', payload)
        message.success('Thêm người dùng thành công')
      }

      closeModal()
      void fetchUsers(pagination.page, pagination.limit)
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) {
        return
      }
      message.error(error instanceof Error ? error.message : 'Không lưu được người dùng')
    } finally {
      setSaving(false)
    }
  }

  const onDeleteUser = async (id: number) => {
    try {
      await apiClient.delete(`/users/${id}`)
      message.success('Xóa người dùng thành công')
      void fetchUsers(pagination.page, pagination.limit)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Xóa người dùng thất bại')
    }
  }

  const onRestoreUser = async (id: number) => {
    try {
      await apiClient.patch(`/users/${id}/restore`)
      message.success('Khôi phục người dùng thành công')
      void fetchUsers(pagination.page, pagination.limit)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Khôi phục người dùng thất bại')
    }
  }

  return (
    <Card className="page-card" variant="borderless">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Quản lý người dùng
          </Typography.Title>
          <Space wrap size={12}>
            <Input
              allowClear
              placeholder="Tìm theo tài khoản, họ tên..."
              prefix={<SearchOutlined style={{ color: '#aaa' }} />}
              style={{ width: 260 }}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
            <Space>
              <span>Hiện đã xóa</span>
              <Switch
                checked={includeInactive}
                onChange={(value) => {
                  setIncludeInactive(value)
                  setPagination((prev) => ({ ...prev, page: 1 }))
                }}
              />
            </Space>
            <Upload
              accept=".xlsx,.xls,.csv"
              showUploadList={false}
              beforeUpload={(file) => {
                const formData = new FormData()
                formData.append('file', file)

                void (async () => {
                  try {
                    const response = await apiClient.post('/users/import', formData, {
                      headers: {
                        'Content-Type': 'multipart/form-data',
                      },
                    })
                    message.success(response.data?.message ?? 'Import người dùng thành công')
                    void fetchUsers(1, pagination.limit)
                  } catch (error) {
                    message.error(
                      error instanceof Error ? error.message : 'Import người dùng thất bại',
                    )
                  }
                })()

                return false
              }}
            >
              <Button icon={<UploadOutlined />}>Import Excel</Button>
            </Upload>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              Thêm người dùng
            </Button>
          </Space>
        </Space>

        {loading && listData.length === 0 ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <Table<UserListItem>
            rowKey="id"
            loading={loading}
            dataSource={listData}
            scroll={{ x: 1340 }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: pagination.total,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total) => `Tổng ${total} người dùng`,
              onChange: (page, pageSize) => {
                void fetchUsers(page, pageSize)
              },
            }}
            columns={[
              { title: 'Tài khoản', dataIndex: 'taiKhoan', width: 140 },
              { title: 'Họ và tên', dataIndex: 'hoVaTen', width: 180 },
              {
                title: 'Ngày sinh',
                dataIndex: 'ngaySinh',
                width: 120,
                render: (value: string | null) =>
                  value ? dayjs(value).format('DD/MM/YYYY') : '-',
              },
              {
                title: 'Giới tính',
                dataIndex: 'gioiTinh',
                width: 100,
                render: (value: string | null) => value ?? '-',
              },
              { title: 'Số điện thoại', dataIndex: 'soDienThoai', width: 130 },
              { title: 'Số giấy tờ', dataIndex: 'soGiayTo', width: 150 },
              {
                title: 'Địa chỉ',
                dataIndex: 'diaChi',
                width: 220,
                render: (value: string | null) => value ?? '-',
              },
              {
                title: 'Email',
                dataIndex: 'email',
                width: 180,
                render: (value: string | null) => value ?? '-',
              },
              {
                title: 'Vai trò',
                dataIndex: 'role',
                width: 140,
                render: (code: string) => <Tag color="blue">{roleLabelMap[code] ?? code}</Tag>,
              },
              {
                title: 'Tuyến được phân công',
                key: 'assignedRoutes',
                width: 220,
                render: (_, record) => {
                  const items = record.assignedRoutes ?? []
                  if (items.length === 0) return '-'
                  return (
                    <Space size={4} wrap>
                      {items.map((route) => (
                        <Tag key={route.id} color="geekblue">
                          {route.tenTuyen}
                        </Tag>
                      ))}
                    </Space>
                  )
                },
              },
              {
                title: 'Trạng thái',
                dataIndex: 'isActive',
                width: 120,
                render: (value: boolean) =>
                  value ? <Tag color="green">Hoạt động</Tag> : <Tag>Khóa</Tag>,
              },
              {
                title: 'Thao tác',
                key: 'actions',
                width: 130,
                fixed: 'right',
                render: (_, record) => (
                  <Space>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openEditModal(record)}
                      disabled={!record.isActive}
                    />
                    {record.isActive ? (
                      <Popconfirm
                        title="Xóa người dùng"
                        description="Bạn chắc chắn muốn xóa người dùng này?"
                        okText="Xóa"
                        cancelText="Hủy"
                        onConfirm={() => void onDeleteUser(record.id)}
                      >
                        <Button danger size="small" icon={<DeleteOutlined />} />
                      </Popconfirm>
                    ) : (
                      <Button size="small" onClick={() => void onRestoreUser(record.id)}>
                        Khôi phục
                      </Button>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Space>

      <Modal
        title={editingUser ? 'Cập nhật người dùng' : 'Thêm người dùng'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => void onSaveUser()}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={saving}
        width={900}
      >
        <Form<UserFormValues>
          form={form}
          layout="vertical"
          initialValues={{
            role: roles[0]?.code ?? 'STAFF',
            isActive: true,
          }}
        >
          <div className="form-grid">
            <Form.Item
              label="Tài khoản"
              name="taiKhoan"
              rules={[{ required: true, message: 'Bắt buộc nhập tài khoản' }]}
            >
              <Input disabled={Boolean(editingUser)} />
            </Form.Item>
            <Form.Item
              label="Họ và tên"
              name="hoVaTen"
              rules={[{ required: true, message: 'Bắt buộc nhập họ tên' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item label="Ngày sinh" name="ngaySinh">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item label="Giới tính" name="gioiTinh">
              <Input placeholder="Nam/Nữ/Khác" />
            </Form.Item>

            <Form.Item
              label="Số điện thoại"
              name="soDienThoai"
              rules={[{ required: true, message: 'Bắt buộc nhập số điện thoại' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Số giấy tờ"
              name="soGiayTo"
              rules={[{ required: true, message: 'Bắt buộc nhập số giấy tờ' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item label="Email" name="email">
              <Input />
            </Form.Item>
            <Form.Item
              label="Vai trò"
              name="role"
              rules={[{ required: true, message: 'Bắt buộc chọn vai trò' }]}
            >
              <Select
                options={roles.map((item) => ({
                  value: item.code,
                  label: item.label,
                }))}
              />
            </Form.Item>

            <Form.Item label="Phân công tuyến đường" name="routeIds" className="full-col">
              <Select
                mode="multiple"
                allowClear
                placeholder="Chọn một hoặc nhiều tuyến đường"
                options={routeOptions.map((item) => ({
                  value: item.id,
                  label: `${item.tenTuyen} (${item.maTuyen})`,
                }))}
              />
            </Form.Item>

            <Form.Item
              className="full-col"
              label="Mật khẩu"
              name="matKhau"
              rules={
                editingUser
                  ? []
                  : [{ required: true, message: 'Bắt buộc nhập mật khẩu khi tạo mới' }]
              }
              extra={editingUser ? 'Để trống nếu không muốn đổi mật khẩu' : undefined}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item className="full-col" label="Địa chỉ" name="diaChi">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item label="Trạng thái" name="isActive" valuePropName="checked" className="full-col">
              <Switch checkedChildren="Hoạt động" unCheckedChildren="Khóa" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </Card>
  )
}
