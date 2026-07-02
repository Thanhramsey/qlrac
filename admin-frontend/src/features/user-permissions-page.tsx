import {
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/axios.instance'
import type { MenuItemNode, RoleMenuResponse, RoleOption } from '../types'

interface UserPermissionsPageProps {
  roles: RoleOption[]
}

interface MenuFormValues {
  menuKey: string
  tenMenu: string
  routePath?: string
  parentId?: number | null
  sortOrder: number
  isActive: boolean
}

function buildAncestorIds(menuId: number, allMenus: MenuItemNode[]) {
  const byId = new Map(allMenus.map((menu) => [menu.id, menu]))
  const result: number[] = []

  let cursor = byId.get(menuId)?.parentId ?? null
  while (cursor) {
    result.push(cursor)
    cursor = byId.get(cursor)?.parentId ?? null
  }

  return result
}

function buildDescendantIds(menuId: number, allMenus: MenuItemNode[]) {
  const result: number[] = []
  const queue: number[] = [menuId]

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (!currentId) {
      continue
    }

    const children = allMenus.filter((item) => item.parentId === currentId)
    for (const child of children) {
      result.push(child.id)
      queue.push(child.id)
    }
  }

  return result
}

export function UserPermissionsPage({ roles }: UserPermissionsPageProps) {
  const [menus, setMenus] = useState<MenuItemNode[]>([])
  const [loadingMenus, setLoadingMenus] = useState(false)
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [selectedRoleCode, setSelectedRoleCode] = useState<string | null>(null)
  const [selectedMenuIds, setSelectedMenuIds] = useState<number[]>([])
  const [menuModalOpen, setMenuModalOpen] = useState(false)
  const [editingMenu, setEditingMenu] = useState<MenuItemNode | null>(null)
  const [savingMenu, setSavingMenu] = useState(false)

  const [form] = Form.useForm<MenuFormValues>()

  const loadMenus = async () => {
    setLoadingMenus(true)
    try {
      const response = await apiClient.get<MenuItemNode[]>('/menus')
      setMenus(response.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách menu')
    } finally {
      setLoadingMenus(false)
    }
  }

  const loadRoleMenus = async (roleCode: string) => {
    setLoadingRoles(true)
    try {
      const response = await apiClient.get<RoleMenuResponse>(`/menus/role/${roleCode}`)
      setSelectedMenuIds(response.data.menuIds)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được phân quyền menu')
    } finally {
      setLoadingRoles(false)
    }
  }

  useEffect(() => {
    void loadMenus()
  }, [])

  useEffect(() => {
    if (roles.length > 0 && !selectedRoleCode) {
      setSelectedRoleCode(roles[0].code)
      void loadRoleMenus(roles[0].code)
    }
  }, [roles, selectedRoleCode])

  const flatMenus = useMemo(() => {
    const out: MenuItemNode[] = []

    for (const menu of menus) {
      out.push(menu)
      for (const child of menu.children ?? []) {
        out.push({ ...child, parent: { id: menu.id, menuKey: menu.menuKey, tenMenu: menu.tenMenu } })
      }
    }

    return out
  }, [menus])

  const openCreateMenu = () => {
    setEditingMenu(null)
    form.setFieldsValue({
      menuKey: '',
      tenMenu: '',
      routePath: '',
      parentId: null,
      sortOrder: 0,
      isActive: true,
    })
    setMenuModalOpen(true)
  }

  const openEditMenu = (menu: MenuItemNode) => {
    setEditingMenu(menu)
    form.setFieldsValue({
      menuKey: menu.menuKey,
      tenMenu: menu.tenMenu,
      routePath: menu.routePath ?? '',
      parentId: menu.parentId ?? null,
      sortOrder: menu.sortOrder,
      isActive: menu.isActive,
    })
    setMenuModalOpen(true)
  }

  const onSaveMenu = async () => {
    try {
      const values = await form.validateFields()
      setSavingMenu(true)

      const payload = {
        ...values,
        routePath: values.routePath?.trim() || null,
        parentId: values.parentId ?? null,
      }

      if (editingMenu) {
        await apiClient.patch(`/menus/${editingMenu.id}`, payload)
        message.success('Cập nhật menu thành công')
      } else {
        await apiClient.post('/menus', payload)
        message.success('Thêm menu thành công')
      }

      setMenuModalOpen(false)
      await loadMenus()
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) {
        return
      }
      message.error(error instanceof Error ? error.message : 'Không thể lưu menu')
    } finally {
      setSavingMenu(false)
    }
  }

  const onDeleteMenu = async (id: number) => {
    try {
      await apiClient.delete(`/menus/${id}`)
      message.success('Xóa menu thành công')
      await loadMenus()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể xóa menu')
    }
  }

  const toggleMenu = (menu: MenuItemNode, checked: boolean) => {
    const current = new Set(selectedMenuIds)
    const descendantIds = buildDescendantIds(menu.id, flatMenus)

    if (checked) {
      current.add(menu.id)
      for (const childId of descendantIds) {
        current.add(childId)
      }
      for (const parentId of buildAncestorIds(menu.id, flatMenus)) {
        current.add(parentId)
      }
    } else {
      current.delete(menu.id)
      for (const childId of descendantIds) {
        current.delete(childId)
      }
    }

    setSelectedMenuIds(Array.from(current))
  }

  const saveRolePermissions = async () => {
    if (!selectedRoleCode) {
      message.warning('Vui lòng chọn role')
      return
    }

    setSavingPermissions(true)
    try {
      await apiClient.put(`/menus/role/${selectedRoleCode}`, {
        menuIds: selectedMenuIds,
      })
      message.success('Lưu phân quyền menu thành công')
      await loadRoleMenus(selectedRoleCode)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không lưu được phân quyền menu')
    } finally {
      setSavingPermissions(false)
    }
  }

  return (
    <Card className="page-card" variant="borderless">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Phân quyền role theo menu
        </Typography.Title>

        <Row gutter={[16, 16]} className="permissions-layout">
          <Col xs={24} md={9}>
            <Card
              className="permission-card role-board"
              title={
                <Space direction="vertical" size={0}>
                  <Typography.Text className="permission-card-kicker">Bảng Role</Typography.Text>
                  <Typography.Text strong>Chọn role để gán quyền menu</Typography.Text>
                </Space>
              }
              size="small"
              loading={loadingRoles}
            >
              <Table<RoleOption>
                className="permission-table role-table"
                rowKey="code"
                dataSource={roles}
                pagination={false}
                size="small"
                rowClassName={(record) =>
                  record.code === selectedRoleCode ? 'ant-table-row-selected' : ''
                }
                onRow={(record) => ({
                  onClick: () => {
                    setSelectedRoleCode(record.code)
                    void loadRoleMenus(record.code)
                  },
                })}
                columns={[
                  {
                    title: 'Mã role',
                    dataIndex: 'code',
                    render: (value: string) => <Tag color="blue">{value}</Tag>,
                  },
                  { title: 'Tên role', dataIndex: 'label' },
                ]}
              />
            </Card>
          </Col>

          <Col xs={24} md={15}>
            <Card
              className="permission-card menu-board"
              title={
                <Space direction="vertical" size={0}>
                  <Typography.Text className="permission-card-kicker">Bảng Menu</Typography.Text>
                  <Typography.Text strong>Tick checkbox để gán menu cho role</Typography.Text>
                </Space>
              }
              size="small"
              loading={loadingMenus}
              extra={
                <Space>
                  <Button onClick={openCreateMenu}>Thêm menu</Button>
                  <Button type="primary" onClick={saveRolePermissions} loading={savingPermissions}>
                    Lưu phân quyền
                  </Button>
                </Space>
              }
            >
              {menus.length === 0 ? (
                <Empty description="Chưa có menu" />
              ) : (
                <Table<MenuItemNode>
                  className="permission-table menu-table"
                  rowKey="id"
                  dataSource={menus}
                  size="small"
                  pagination={false}
                  expandable={{
                    defaultExpandAllRows: true,
                  }}
                  columns={[
                    {
                      title: 'Gán',
                      width: 70,
                      render: (_, record) => (
                        <Checkbox
                          checked={selectedMenuIds.includes(record.id)}
                          onChange={(event) => toggleMenu(record, event.target.checked)}
                        />
                      ),
                    },
                    {
                      title: 'Tên menu',
                      dataIndex: 'tenMenu',
                    },
                    {
                      title: 'Key',
                      dataIndex: 'menuKey',
                    },
                    {
                      title: 'Route',
                      dataIndex: 'routePath',
                      render: (value: string | null | undefined) => value || '-',
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
                      width: 140,
                      render: (_, record) => (
                        <Space>
                          <Button size="small" onClick={() => openEditMenu(record)}>
                            Sửa
                          </Button>
                          <Popconfirm
                            title="Xóa menu"
                            description="Bạn chắc chắn muốn xóa menu này?"
                            okText="Xóa"
                            cancelText="Hủy"
                            onConfirm={() => onDeleteMenu(record.id)}
                          >
                            <Button size="small" danger>
                              Xóa
                            </Button>
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
              )}
            </Card>
          </Col>
        </Row>
      </Space>

      <Modal
        title={editingMenu ? 'Cập nhật menu' : 'Thêm menu'}
        open={menuModalOpen}
        onCancel={() => setMenuModalOpen(false)}
        onOk={onSaveMenu}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={savingMenu}
      >
        <Form<MenuFormValues> form={form} layout="vertical" initialValues={{ sortOrder: 0, isActive: true }}>
          <Form.Item
            label="Tên menu"
            name="tenMenu"
            rules={[{ required: true, message: 'Vui lòng nhập tên menu' }]}
          >
            <Input placeholder="VD: Báo cáo" />
          </Form.Item>

          <Form.Item
            label="Mã menu (key)"
            name="menuKey"
            rules={[{ required: true, message: 'Vui lòng nhập mã menu' }]}
          >
            <Input placeholder="VD: reports" />
          </Form.Item>

          <Form.Item label="Route path" name="routePath">
            <Input placeholder="VD: /reports" />
          </Form.Item>

          <Form.Item label="Menu cha" name="parentId">
            <Select
              allowClear
              placeholder="Chọn menu cha nếu là menu con"
              options={flatMenus
                .filter((item) => !editingMenu || item.id !== editingMenu.id)
                .map((item) => ({
                  value: item.id,
                  label: `${item.parentId ? '↳ ' : ''}${item.tenMenu} (${item.menuKey})`,
                }))}
            />
          </Form.Item>

          <Form.Item label="Thứ tự" name="sortOrder">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="Trạng thái" name="isActive" valuePropName="checked">
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Khóa" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
