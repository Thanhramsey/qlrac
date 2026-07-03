import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Typography,
  message,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/axios.instance'
import type { PagedResponse, SystemParameterItem } from '../types'

type SystemParameterFormValues = {
  tenThamSo: string
  giaTri: string
}

export function SystemParametersPage() {
  const [items, setItems] = useState<SystemParameterItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SystemParameterItem | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)

  const [form] = Form.useForm<SystemParameterFormValues>()

  const fetchData = async (nextPage = page, nextLimit = limit) => {
    setLoading(true)
    try {
      const response = await apiClient.get<PagedResponse<SystemParameterItem>>('/system-parameters', {
        params: { page: nextPage, limit: nextLimit },
      })

      setItems(response.data.data)
      setPage(response.data.pagination.page)
      setLimit(response.data.pagination.limit)
      setTotal(response.data.pagination.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được tham số hệ thống')
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
      tenThamSo: '',
      giaTri: '',
    })
    setModalOpen(true)
  }

  const openEditModal = (item: SystemParameterItem) => {
    setEditingItem(item)
    form.setFieldsValue({
      tenThamSo: item.tenThamSo,
      giaTri: item.giaTri,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      if (editingItem) {
        await apiClient.patch(`/system-parameters/${editingItem.id}`, values)
        message.success('Cập nhật tham số thành công')
      } else {
        await apiClient.post('/system-parameters', values)
        message.success('Thêm tham số thành công')
      }

      setModalOpen(false)
      void fetchData(page, limit)
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) {
        return
      }

      message.error(error instanceof Error ? error.message : 'Không thể lưu tham số')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/system-parameters/${id}`)
      message.success('Xóa tham số thành công')
      void fetchData(page, limit)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể xóa tham số')
    }
  }

  const columns = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        key: 'id',
        width: 90,
      },
      {
        title: 'Thời gian tạo',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 190,
        render: (value: string) => new Date(value).toLocaleString('vi-VN'),
      },
      {
        title: 'Tên tham số',
        dataIndex: 'tenThamSo',
        key: 'tenThamSo',
        width: 260,
      },
      {
        title: 'Giá trị',
        dataIndex: 'giaTri',
        key: 'giaTri',
      },
      {
        title: 'Hành động',
        key: 'action',
        width: 170,
        fixed: 'right' as const,
        render: (_: unknown, item: SystemParameterItem) => (
          <Space>
            <Button size="small" onClick={() => openEditModal(item)}>
              Sửa
            </Button>
            <Popconfirm
              title="Xóa tham số"
              description={`Bạn có chắc muốn xóa ${item.tenThamSo}?`}
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
      title={<Typography.Title level={5}>Tham số hệ thống</Typography.Title>}
      extra={
        <Button type="primary" onClick={openCreateModal}>
          Thêm tham số
        </Button>
      }
    >
      <Table<SystemParameterItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={items}
        scroll={{ x: 1000 }}
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
        title={editingItem ? 'Cập nhật tham số hệ thống' : 'Thêm tham số hệ thống'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText={editingItem ? 'Cập nhật' : 'Tạo mới'}
        cancelText="Hủy"
        confirmLoading={submitting}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="tenThamSo"
            label="Tên tham số"
            rules={[{ required: true, message: 'Vui lòng nhập tên tham số' }]}
          >
            <Input placeholder="VD: Tên đơn vị" />
          </Form.Item>

          <Form.Item
            name="giaTri"
            label="Giá trị"
            rules={[{ required: true, message: 'Vui lòng nhập giá trị' }]}
          >
            <Input.TextArea rows={4} placeholder="Nhập giá trị tham số" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
