import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, SyncOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { apiClient } from '../api/axios.instance'
import type { BillingPeriodConfig, BillingPeriodItem, PagedResponse } from '../types'

type BillingPeriodFormValues = {
  maKy?: string
  tenKy?: string
  ngayBatDau: dayjs.Dayjs
  ngayKetThuc: dayjs.Dayjs
  isClosed: boolean
}

export function BillingPeriodsPage() {
  const [listData, setListData] = useState<BillingPeriodItem[]>([])
  const [config, setConfig] = useState<BillingPeriodConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingItem, setEditingItem] = useState<BillingPeriodItem | null>(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 })

  const [form] = Form.useForm<BillingPeriodFormValues>()

  const fetchBillingPeriods = async (page = pagination.page, limit = pagination.limit) => {
    setLoading(true)
    try {
      const response = await apiClient.get<PagedResponse<BillingPeriodItem>>('/billing-periods', {
        params: { page, limit },
      })
      setListData(response.data.data)
      setPagination({
        page: response.data.pagination.page,
        limit: response.data.pagination.limit,
        total: response.data.pagination.total,
      })
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách kỳ hóa đơn')
    } finally {
      setLoading(false)
    }
  }

  const fetchConfig = async () => {
    try {
      const response = await apiClient.get<BillingPeriodConfig>('/billing-periods/config')
      setConfig(response.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được cấu hình tự động')
    }
  }

  useEffect(() => {
    void fetchBillingPeriods(1, 10)
    void fetchConfig()
  }, [])

  const openCreateModal = () => {
    setEditingItem(null)
    form.resetFields()
    form.setFieldsValue({
      isClosed: false,
      ngayBatDau: dayjs().startOf('month'),
      ngayKetThuc: dayjs().endOf('month'),
    })
    setModalOpen(true)
  }

  const openEditModal = (item: BillingPeriodItem) => {
    setEditingItem(item)
    form.setFieldsValue({
      maKy: item.maKy,
      tenKy: item.tenKy,
      ngayBatDau: dayjs(item.ngayBatDau),
      ngayKetThuc: dayjs(item.ngayKetThuc),
      isClosed: item.isClosed,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingItem(null)
    form.resetFields()
  }

  const onSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      const payload = {
        maKy: values.maKy?.trim() || undefined,
        tenKy: values.tenKy?.trim() || undefined,
        ngayBatDau: values.ngayBatDau.format('YYYY-MM-DD'),
        ngayKetThuc: values.ngayKetThuc.format('YYYY-MM-DD'),
        isClosed: values.isClosed,
      }

      if (editingItem) {
        await apiClient.patch(`/billing-periods/${editingItem.id}`, payload)
        message.success('Cập nhật kỳ hóa đơn thành công')
      } else {
        await apiClient.post('/billing-periods', payload)
        message.success('Thêm kỳ hóa đơn thành công')
      }

      closeModal()
      void fetchBillingPeriods(pagination.page, pagination.limit)
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) {
        return
      }
      message.error(error instanceof Error ? error.message : 'Không lưu được kỳ hóa đơn')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: number) => {
    try {
      await apiClient.delete(`/billing-periods/${id}`)
      message.success('Xóa kỳ hóa đơn thành công')
      void fetchBillingPeriods(pagination.page, pagination.limit)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Xóa kỳ hóa đơn thất bại')
    }
  }

  const onToggleAutoCreate = async (enabled: boolean) => {
    try {
      setSavingConfig(true)
      await apiClient.patch('/billing-periods/config', {
        autoCreateEnabled: enabled,
      })
      message.success('Cập nhật chế độ tự động thành công')
      await fetchConfig()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không cập nhật được chế độ tự động')
    } finally {
      setSavingConfig(false)
    }
  }

  const onRunAutoCreateNow = async () => {
    try {
      await apiClient.post('/billing-periods/auto-generate-now')
      message.success('Đã tạo kỳ hóa đơn tự động (nếu thiếu)')
      await fetchBillingPeriods(1, pagination.limit)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể tạo kỳ tự động')
    }
  }

  return (
    <Card className="page-card" variant="borderless">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Quản lý kỳ hóa đơn</h3>
          <Space>
            <Space>
              <span>Tự động tạo kỳ theo tháng</span>
              <Switch
                checked={config?.autoCreateEnabled ?? true}
                loading={savingConfig}
                onChange={(value) => void onToggleAutoCreate(value)}
              />
            </Space>
            <Button icon={<SyncOutlined />} onClick={() => void onRunAutoCreateNow()}>
              Tạo tự động ngay
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              Thêm kỳ hóa đơn
            </Button>
          </Space>
        </Space>

        <Table<BillingPeriodItem>
          rowKey="id"
          loading={loading}
          dataSource={listData}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            showSizeChanger: true,
            onChange: (page, pageSize) => void fetchBillingPeriods(page, pageSize),
          }}
          columns={[
            { title: 'Mã kỳ', dataIndex: 'maKy', width: 120 },
            { title: 'Tên kỳ', dataIndex: 'tenKy', width: 180 },
            {
              title: 'Ngày bắt đầu',
              dataIndex: 'ngayBatDau',
              width: 140,
              render: (value: string) => dayjs(value).format('DD/MM/YYYY'),
            },
            {
              title: 'Ngày kết thúc',
              dataIndex: 'ngayKetThuc',
              width: 140,
              render: (value: string) => dayjs(value).format('DD/MM/YYYY'),
            },
            {
              title: 'Tự động',
              dataIndex: 'isAutoGenerated',
              width: 110,
              render: (value: boolean) =>
                value ? <Tag color="cyan">Tự động</Tag> : <Tag>Thủ công</Tag>,
            },
            {
              title: 'Trạng thái',
              dataIndex: 'isClosed',
              width: 120,
              render: (value: boolean) =>
                value ? <Tag color="red">Đã khóa</Tag> : <Tag color="green">Đang mở</Tag>,
            },
            {
              title: 'Thao tác',
              key: 'actions',
              width: 140,
              render: (_, record) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
                  <Popconfirm
                    title="Xóa kỳ hóa đơn"
                    description="Bạn chắc chắn muốn xóa kỳ này?"
                    okText="Xóa"
                    cancelText="Hủy"
                    onConfirm={() => void onDelete(record.id)}
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
        title={editingItem ? 'Cập nhật kỳ hóa đơn' : 'Thêm kỳ hóa đơn'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => void onSave()}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={saving}
      >
        <Form<BillingPeriodFormValues> form={form} layout="vertical" initialValues={{ isClosed: false }}>
          <Form.Item label="Mã kỳ" name="maKy">
            <Input placeholder="VD: 2026-07" />
          </Form.Item>
          <Form.Item label="Tên kỳ" name="tenKy">
            <Input placeholder="VD: Kỳ 07/2026" />
          </Form.Item>
          <Form.Item
            label="Ngày bắt đầu"
            name="ngayBatDau"
            rules={[{ required: true, message: 'Bắt buộc chọn ngày bắt đầu' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item
            label="Ngày kết thúc"
            name="ngayKetThuc"
            rules={[{ required: true, message: 'Bắt buộc chọn ngày kết thúc' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item label="Đóng kỳ" name="isClosed" valuePropName="checked">
            <Switch checkedChildren="Đã khóa" unCheckedChildren="Đang mở" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default BillingPeriodsPage
