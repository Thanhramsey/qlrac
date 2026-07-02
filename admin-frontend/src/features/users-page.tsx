import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { apiClient } from '../api/axios.instance'
import type { RoleOption, UserListItem, UserListResponse } from '../types'
import { useEffect, useMemo, useState } from 'react'

interface UsersPageProps {
  roles: RoleOption[]
}

type UserFormValues = {
  taiKhoan: string
  matKhau?: string
  hoVaTen: string
  ngaySinh?: dayjs.Dayjs
  gioiTinh?: string
  soDienThoai: string
  soGiayTo: string
  diaChi?: string
  email?: string
  role: string
  isActive?: boolean
}

const genderOptions = [
  { value: 'Nam', label: 'Nam' },
  { value: 'Nu', label: 'Nữ' },
  { value: 'Khac', label: 'Khác' },
]

export function UsersPage({ roles }: UsersPageProps) {
  const [form] = Form.useForm<UserFormValues>()
  const [listData, setListData] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  })

  const roleLabelMap = useMemo(
    () => Object.fromEntries(roles.map((item) => [item.code, item.label])),
    [roles],
  )

  const fetchUsers = async (page = pagination.page, limit = pagination.limit) => {
    setLoading(true)
    try {
      const response = await apiClient.get<UserListResponse>('/users', {
        params: { page, limit },
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
    void fetchUsers(1, 10)
  }, [])

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
      setSaving(true)

      const payload = {
        ...values,
        ngaySinh: values.ngaySinh ? values.ngaySinh.format('YYYY-MM-DD') : undefined,
      }

      if (editingUser) {
        if (!payload.matKhau) {
          delete payload.matKhau
        }

        await apiClient.patch(`/users/${editingUser.id}`, payload)
        message.success('Cập nhật người dùng thành công')
      } else {
        if (!payload.matKhau) {
          message.error('Mật khẩu là bắt buộc khi tạo mới người dùng')
          return
        }

        await apiClient.post('/users', payload)
        message.success('Tạo người dùng thành công')
      }

      closeModal()
      void fetchUsers(pagination.page, pagination.limit)
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
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

  return (
    <Card className="page-card" variant="borderless">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Danh sách người dùng
          </Typography.Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Thêm người dùng
          </Button>
        </Space>

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
              title: 'Quyền',
              dataIndex: 'role',
              width: 170,
              render: (value: string, record) => (
                <Tag color={record.isActive ? 'blue' : 'default'}>
                  {record.roleLabel ?? roleLabelMap[value] ?? value}
                </Tag>
              ),
            },
            {
              title: 'Trạng thái',
              dataIndex: 'isActive',
              width: 120,
              render: (value: boolean) =>
                value ? <Tag color="green">Kích hoạt</Tag> : <Tag>Khóa</Tag>,
            },
            {
              title: 'Thao tác',
              key: 'actions',
              fixed: 'right',
              width: 140,
              render: (_, record) => (
                <Space>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEditModal(record)}
                  />
                  <Popconfirm
                    title="Xóa người dùng"
                    description="Bạn chắc chắn muốn xóa người dùng này?"
                    okText="Xóa"
                    cancelText="Hủy"
                    onConfirm={() => void onDeleteUser(record.id)}
                  >
                    <Button danger size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Space>

      <Modal
        title={editingUser ? 'Cập nhật người dùng' : 'Thêm người dùng'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => void onSaveUser()}
        okText="Lưu"
        cancelText="Hủy"
        okButtonProps={{ loading: saving }}
        width={760}
      >
        <Form
          layout="vertical"
          form={form}
          initialValues={{ role: roles[0]?.code ?? 'STAFF', isActive: true }}
        >
          <div className="form-grid">
            <Form.Item
              label="Tài khoản"
              name="taiKhoan"
              rules={[{ required: true, message: 'Bắt buộc nhập tài khoản' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label={editingUser ? 'Mật khẩu mới (không bắt buộc)' : 'Mật khẩu'}
              name="matKhau"
              rules={editingUser ? [] : [{ required: true, message: 'Bắt buộc nhập mật khẩu' }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              label="Họ và tên"
              name="hoVaTen"
              rules={[{ required: true, message: 'Bắt buộc nhập họ và tên' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item label="Ngày sinh" name="ngaySinh">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item label="Giới tính" name="gioiTinh">
              <Select allowClear options={genderOptions} />
            </Form.Item>
            <Form.Item
              label="Số điện thoại"
              name="soDienThoai"
              rules={[{ required: true, message: 'Bắt buộc nhập số điện thoại' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Số giấy tờ (CCCD/CMND)"
              name="soGiayTo"
              rules={[{ required: true, message: 'Bắt buộc nhập số giấy tờ' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item label="Email" name="email">
              <Input />
            </Form.Item>
            <Form.Item label="Địa chỉ" name="diaChi" className="full-col">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item label="Quyền" name="role" rules={[{ required: true }]}>
              <Select
                options={roles.map((item) => ({
                  value: item.code,
                  label: item.label,
                }))}
              />
            </Form.Item>
            <Form.Item label="Trạng thái" name="isActive">
              <Select
                options={[
                  { value: true, label: 'Kích hoạt' },
                  { value: false, label: 'Khóa' },
                ]}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </Card>
  )
}
