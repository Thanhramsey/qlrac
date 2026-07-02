import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { PlusOutlined } from '@ant-design/icons'
import { apiClient } from '../api/axios.instance'
import type { RoleOption, UserListItem, UserListResponse } from '../types'
import { useEffect, useMemo, useState } from 'react'

interface UsersPageProps {
  roles: RoleOption[]
}

type CreateUserFormValues = {
  taiKhoan: string
  matKhau: string
  hoVaTen: string
  ngaySinh?: dayjs.Dayjs
  gioiTinh?: string
  soDienThoai: string
  soGiayTo: string
  diaChi?: string
  email?: string
  role: RoleOption['code']
}

const genderOptions = [
  { value: 'Nam', label: 'Nam' },
  { value: 'Nu', label: 'Nữ' },
  { value: 'Khac', label: 'Khác' },
]

const roleColor: Record<RoleOption['code'], string> = {
  ADMIN: 'red',
  ADMIN_LEVEL_2: 'volcano',
  ACCOUNTANT: 'gold',
  STAFF: 'blue',
}

export function UsersPage({ roles }: UsersPageProps) {
  const [form] = Form.useForm<CreateUserFormValues>()
  const [listData, setListData] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
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
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách người dùng')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchUsers(1, 10)
  }, [])

  const onCreateUser = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      await apiClient.post('/users', {
        ...values,
        ngaySinh: values.ngaySinh ? values.ngaySinh.format('YYYY-MM-DD') : undefined,
      })

      message.success('Tạo người dùng thành công')
      setModalOpen(false)
      form.resetFields()
      void fetchUsers(1, pagination.limit)
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="page-card" variant="borderless">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Danh sách người dùng
          </Typography.Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Thêm người dùng
          </Button>
        </Space>

        <Table<UserListItem>
          rowKey="id"
          loading={loading}
          dataSource={listData}
          scroll={{ x: 1200 }}
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
              render: (value: string | null) => (value ? dayjs(value).format('DD/MM/YYYY') : '-'),
            },
            { title: 'Giới tính', dataIndex: 'gioiTinh', width: 100, render: (value: string | null) => value ?? '-' },
            { title: 'Số điện thoại', dataIndex: 'soDienThoai', width: 130 },
            { title: 'Số giấy tờ', dataIndex: 'soGiayTo', width: 150 },
            { title: 'Địa chỉ', dataIndex: 'diaChi', width: 220, render: (value: string | null) => value ?? '-' },
            { title: 'Email', dataIndex: 'email', width: 180, render: (value: string | null) => value ?? '-' },
            {
              title: 'Quyền',
              dataIndex: 'role',
              width: 150,
              render: (value: RoleOption['code']) => (
                <Tag color={roleColor[value]}>{roleLabelMap[value] ?? value}</Tag>
              ),
            },
            {
              title: 'Trạng thái',
              dataIndex: 'isActive',
              width: 120,
              render: (value: boolean) => (value ? <Tag color="green">Kích hoạt</Tag> : <Tag>Khóa</Tag>),
            },
          ]}
        />
      </Space>

      <Modal
        title="Thêm người dùng"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
        onOk={() => void onCreateUser()}
        okText="Lưu"
        cancelText="Hủy"
        okButtonProps={{ loading: saving }}
        width={760}
      >
        <Form layout="vertical" form={form} initialValues={{ role: 'STAFF' }}>
          <div className="form-grid">
            <Form.Item
              label="Tài khoản"
              name="taiKhoan"
              rules={[{ required: true, message: 'Bắt buộc nhập tài khoản' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Mật khẩu"
              name="matKhau"
              rules={[{ required: true, message: 'Bắt buộc nhập mật khẩu' }]}
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
          </div>
        </Form>
      </Modal>
    </Card>
  )
}
