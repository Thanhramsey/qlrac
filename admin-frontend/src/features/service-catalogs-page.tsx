import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/axios.instance'
import type { PagedResponse, ServiceCatalogItem } from '../types'

interface ServiceCatalogFormValues {
  maDichVu: string
  tenDichVu: string
  giaDichVu: number
  thuePhanTram: number
  isActive: boolean
  ghiChu?: string
}

export function ServiceCatalogsPage() {
  const [items, setItems] = useState<ServiceCatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ServiceCatalogItem | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)

  const [form] = Form.useForm<ServiceCatalogFormValues>()

  const fetchData = async (nextPage = page, nextLimit = limit) => {
    setLoading(true)
    try {
      const response = await apiClient.get<PagedResponse<ServiceCatalogItem>>(
        '/service-catalogs',
        {
          params: { page: nextPage, limit: nextLimit },
        },
      )
      setItems(response.data.data)
      setTotal(response.data.pagination.total)
      setPage(response.data.pagination.page)
      setLimit(response.data.pagination.limit)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh mục dịch vụ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData(1, limit)
  }, [])

  const openCreateModal = () => {
    setEditingItem(null)
    form.setFieldsValue({
      maDichVu: '',
      tenDichVu: '',
      giaDichVu: 0,
      thuePhanTram: 0,
      isActive: true,
      ghiChu: '',
    })
    setModalOpen(true)
  }

  const openEditModal = (item: ServiceCatalogItem) => {
    setEditingItem(item)
    form.setFieldsValue({
      maDichVu: item.maDichVu,
      tenDichVu: item.tenDichVu,
      giaDichVu: item.giaDichVu,
      thuePhanTram: item.thuePhanTram,
      isActive: item.isActive,
      ghiChu: item.ghiChu ?? '',
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/service-catalogs/${id}`)
      message.success('Xóa dịch vụ thành công')
      void fetchData(page, limit)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể xóa dịch vụ')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      if (editingItem) {
        await apiClient.patch(`/service-catalogs/${editingItem.id}`, values)
        message.success('Cập nhật dịch vụ thành công')
      } else {
        await apiClient.post('/service-catalogs', values)
        message.success('Thêm dịch vụ thành công')
      }

      setModalOpen(false)
      void fetchData(page, limit)
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) {
        return
      }
      message.error(error instanceof Error ? error.message : 'Không thể lưu dịch vụ')
    } finally {
      setSubmitting(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        title: 'Mã dịch vụ',
        dataIndex: 'maDichVu',
        key: 'maDichVu',
        width: 150,
      },
      {
        title: 'Tên dịch vụ',
        dataIndex: 'tenDichVu',
        key: 'tenDichVu',
        width: 220,
      },
      {
        title: 'Giá',
        dataIndex: 'giaDichVu',
        key: 'giaDichVu',
        width: 140,
        render: (value: number) => `${value.toLocaleString('vi-VN')} đ`,
      },
      {
        title: 'Thuế (%)',
        dataIndex: 'thuePhanTram',
        key: 'thuePhanTram',
        width: 120,
      },
      {
        title: 'Tình trạng',
        dataIndex: 'isActive',
        key: 'isActive',
        width: 130,
        render: (value: boolean) =>
          value ? <Tag color="green">Hoạt động</Tag> : <Tag color="red">Khóa</Tag>,
      },
      {
        title: 'Ghi chú',
        dataIndex: 'ghiChu',
        key: 'ghiChu',
      },
      {
        title: 'Hành động',
        key: 'action',
        width: 160,
        fixed: 'right' as const,
        render: (_: unknown, item: ServiceCatalogItem) => (
          <Space>
            <Button size="small" onClick={() => openEditModal(item)}>
              Sửa
            </Button>
            <Popconfirm
              title="Xóa dịch vụ"
              description={`Bạn có chắc muốn xóa ${item.tenDichVu}?`}
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => handleDelete(item.id)}
            >
              <Button size="small" danger>
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [],
  )

  return (
    <Card
      className="page-card"
      title={<Typography.Title level={5}>Danh mục dịch vụ</Typography.Title>}
      extra={<Button type="primary" onClick={openCreateModal}>Thêm dịch vụ</Button>}
    >
      <Table<ServiceCatalogItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={items}
        scroll={{ x: 1150 }}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          onChange: (nextPage, nextPageSize) => {
            void fetchData(nextPage, nextPageSize)
          },
        }}
      />

      <Modal
        title={editingItem ? 'Cập nhật dịch vụ' : 'Thêm dịch vụ'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText={editingItem ? 'Cập nhật' : 'Tạo mới'}
        cancelText="Hủy"
        confirmLoading={submitting}
        width={760}
      >
        <Form form={form} layout="vertical" initialValues={{ isActive: true }}>
          <Form.Item
            name="maDichVu"
            label="Mã dịch vụ"
            rules={[{ required: true, message: 'Vui lòng nhập mã dịch vụ' }]}
          >
            <Input placeholder="VD: SH001" />
          </Form.Item>

          <Form.Item
            name="tenDichVu"
            label="Tên dịch vụ"
            rules={[{ required: true, message: 'Vui lòng nhập tên dịch vụ' }]}
          >
            <Input placeholder="VD: Phí rác sinh hoạt" />
          </Form.Item>

          <Form.Item
            name="giaDichVu"
            label="Giá dịch vụ"
            rules={[{ required: true, message: 'Vui lòng nhập giá dịch vụ' }]}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="thuePhanTram"
            label="Thuế (%)"
            rules={[{ required: true, message: 'Vui lòng nhập thuế phần trăm' }]}
          >
            <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="isActive" label="Tình trạng" valuePropName="checked">
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Khóa" />
          </Form.Item>

          <Form.Item name="ghiChu" label="Ghi chú">
            <Input.TextArea rows={3} placeholder="Nhập ghi chú (nếu có)" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
