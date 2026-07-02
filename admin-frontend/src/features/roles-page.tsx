import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { apiClient } from '../api/axios.instance'
import type { RoleOption } from '../types'

interface RolesPageProps {
  roles: RoleOption[]
  loading: boolean
  onRolesChanged: () => Promise<void>
}

type RoleFormValues = {
  code: string
  label: string
  moTa?: string
  isActive: boolean
}

export function RolesPage({ roles, loading, onRolesChanged }: RolesPageProps) {
  const [form] = Form.useForm<RoleFormValues>()
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleOption | null>(null)

  useEffect(() => {
    if (!modalOpen) {
      form.resetFields()
    }
  }, [modalOpen, form])

  const openCreateModal = () => {
    setEditingRole(null)
    form.resetFields()
    form.setFieldsValue({ isActive: true })
    setModalOpen(true)
  }

  const openEditModal = (role: RoleOption) => {
    setEditingRole(role)
    form.setFieldsValue({
      code: role.code,
      label: role.label,
      moTa: role.moTa ?? undefined,
      isActive: role.isActive ?? true,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingRole(null)
    form.resetFields()
  }

  const onSaveRole = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      if (editingRole) {
        await apiClient.patch(`/roles/${editingRole.code}`, {
          label: values.label,
          moTa: values.moTa,
          isActive: values.isActive,
        })
        message.success('Cập nhật quyền thành công')
      } else {
        await apiClient.post('/roles', values)
        message.success('Thêm quyền thành công')
      }

      closeModal()
      await onRolesChanged()
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const onDeleteRole = async (code: string) => {
    try {
      await apiClient.delete(`/roles/${code}`)
      message.success('Xóa quyền thành công')
      await onRolesChanged()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Xóa quyền thất bại')
    }
  }

  return (
    <Card loading={loading} className="page-card" variant="borderless">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Quản lý quyền
          </Typography.Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Thêm quyền
          </Button>
        </Space>

        <Table<RoleOption>
          rowKey="code"
          dataSource={roles}
          pagination={false}
          columns={[
            {
              title: 'Mã quyền',
              dataIndex: 'code',
              width: 180,
              render: (value: string) => <Tag color="blue">{value}</Tag>,
            },
            {
              title: 'Tên quyền',
              dataIndex: 'label',
              width: 240,
            },
            {
              title: 'Mô tả',
              dataIndex: 'moTa',
              render: (value: string | null | undefined) => value || '-',
            },
            {
              title: 'Trạng thái',
              dataIndex: 'isActive',
              width: 140,
              render: (value: boolean | undefined) =>
                value !== false ? (
                  <Tag color="green">Kích hoạt</Tag>
                ) : (
                  <Tag>Khóa</Tag>
                ),
            },
            {
              title: 'Thao tác',
              key: 'actions',
              width: 130,
              render: (_, record) => (
                <Space>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEditModal(record)}
                  />
                  <Popconfirm
                    title="Xóa quyền"
                    description="Bạn chắc chắn muốn xóa quyền này?"
                    okText="Xóa"
                    cancelText="Hủy"
                    onConfirm={() => void onDeleteRole(record.code)}
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
        title={editingRole ? 'Cập nhật quyền' : 'Thêm quyền'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => void onSaveRole()}
        okText="Lưu"
        cancelText="Hủy"
        okButtonProps={{ loading: saving }}
      >
        <Form
          layout="vertical"
          form={form}
          initialValues={{
            isActive: true,
          }}
        >
          <Form.Item
            label="Mã quyền"
            name="code"
            rules={[{ required: true, message: 'Bắt buộc nhập mã quyền' }]}
          >
            <Input placeholder="VD: OPERATOR" disabled={Boolean(editingRole)} />
          </Form.Item>

          <Form.Item
            label="Tên quyền"
            name="label"
            rules={[{ required: true, message: 'Bắt buộc nhập tên quyền' }]}
          >
            <Input placeholder="VD: Điều phối" />
          </Form.Item>

          <Form.Item label="Mô tả" name="moTa">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item label="Trạng thái" name="isActive" valuePropName="checked">
            <Switch checkedChildren="Kích hoạt" unCheckedChildren="Khóa" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
