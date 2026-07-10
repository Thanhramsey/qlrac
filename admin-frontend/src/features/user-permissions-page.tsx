import {
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
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
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/axios.instance'
import type {
  MenuItemNode,
  PermissionItem,
  RoleMenuResponse,
  RoleOption,
  RolePermissionResponse,
} from '../types'

interface UserPermissionsPageProps {
  roles: RoleOption[]
}

interface MenuFormValues {
  menuKey: string
  tenMenu: string
  routePath?: string
  parentId?: number | null
  sortOrder: number
  viewMobile: boolean
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
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [loadingMenus, setLoadingMenus] = useState(false)
  const [loadingPermissions, setLoadingPermissions] = useState(false)
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [loadingRolePermissions, setLoadingRolePermissions] = useState(false)
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [savingApiPermissions, setSavingApiPermissions] = useState(false)
  const [selectedRoleCode, setSelectedRoleCode] = useState<string | null>(null)
  const [selectedMenuIds, setSelectedMenuIds] = useState<number[]>([])
  const [selectedPermissionCodes, setSelectedPermissionCodes] = useState<string[]>([])
  const [permissionKeyword, setPermissionKeyword] = useState('')
  const [safeMode, setSafeMode] = useState(true)
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

  const loadPermissions = async () => {
    setLoadingPermissions(true)
    try {
      const response = await apiClient.get<PermissionItem[]>('/roles/permissions')
      setPermissions(response.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách quyền API')
    } finally {
      setLoadingPermissions(false)
    }
  }

  const loadRoleApiPermissions = async (roleCode: string) => {
    setLoadingRolePermissions(true)
    try {
      const response = await apiClient.get<RolePermissionResponse>(`/roles/${roleCode}/permissions`)
      setSelectedPermissionCodes(response.data.permissionCodes)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được quyền API của role')
    } finally {
      setLoadingRolePermissions(false)
    }
  }

  useEffect(() => {
    void loadMenus()
    void loadPermissions()
  }, [])

  useEffect(() => {
    if (roles.length > 0 && !selectedRoleCode) {
      setSelectedRoleCode(roles[0].code)
      void loadRoleMenus(roles[0].code)
      void loadRoleApiPermissions(roles[0].code)
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
      viewMobile: false,
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
      viewMobile: menu.viewMobile,
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

  const permissionsByModule = useMemo(() => {
    const keyword = permissionKeyword.trim().toLowerCase()
    const grouped = new Map<string, PermissionItem[]>()

    for (const permission of permissions) {
      if (keyword) {
        const haystack = `${permission.code} ${permission.label} ${permission.moTa ?? ''} ${permission.moduleKey}`
          .toLowerCase()
          .trim()

        if (!haystack.includes(keyword)) {
          continue
        }
      }

      const moduleKey = permission.moduleKey || 'other'
      const current = grouped.get(moduleKey) ?? []
      current.push(permission)
      grouped.set(moduleKey, current)
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([moduleKey, items]) => ({
        moduleKey,
        items: [...items].sort((a, b) => a.code.localeCompare(b.code)),
      }))
  }, [permissions, permissionKeyword])

  const selectedPermissionSet = useMemo(
    () => new Set(selectedPermissionCodes),
    [selectedPermissionCodes],
  )

  const isDangerousPermission = (code: string) =>
    code.endsWith('.delete') || code.endsWith('.restore')

  const isPermissionLocked = (permission: PermissionItem) =>
    safeMode && isDangerousPermission(permission.code)

  const toggleApiPermission = (permissionCode: string, checked: boolean) => {
    if (checked && safeMode && isDangerousPermission(permissionCode)) {
      return
    }

    const next = new Set(selectedPermissionCodes)
    if (checked) {
      next.add(permissionCode)
    } else {
      next.delete(permissionCode)
    }
    setSelectedPermissionCodes(Array.from(next))
  }

  const toggleModulePermissions = (moduleKey: string, checked: boolean) => {
    const modulePermissions = permissionsByModule.find((item) => item.moduleKey === moduleKey)
    if (!modulePermissions) {
      return
    }

    const next = new Set(selectedPermissionCodes)
    for (const permission of modulePermissions.items) {
      if (safeMode && isDangerousPermission(permission.code)) {
        continue
      }

      if (checked) {
        next.add(permission.code)
      } else {
        next.delete(permission.code)
      }
    }
    setSelectedPermissionCodes(Array.from(next))
  }

  const selectAllApiPermissions = () => {
    const next = new Set(selectedPermissionCodes)

    for (const group of permissionsByModule) {
      for (const permission of group.items) {
        if (safeMode && isDangerousPermission(permission.code)) {
          continue
        }
        next.add(permission.code)
      }
    }

    setSelectedPermissionCodes(Array.from(next))
  }

  const clearAllApiPermissions = () => {
    setSelectedPermissionCodes([])
  }

  const saveRoleApiPermissions = async () => {
    if (!selectedRoleCode) {
      message.warning('Vui lòng chọn role')
      return
    }

    setSavingApiPermissions(true)
    try {
      await apiClient.put(`/roles/${selectedRoleCode}/permissions`, {
        permissionCodes: selectedPermissionCodes,
      })
      message.success('Lưu quyền API thành công')
      await loadRoleApiPermissions(selectedRoleCode)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không lưu được quyền API')
    } finally {
      setSavingApiPermissions(false)
    }
  }

  const moduleStats = (moduleKey: string, moduleItems: PermissionItem[]) => {
    const selectableItems = moduleItems.filter((item) =>
      safeMode ? !isDangerousPermission(item.code) : true,
    )
    const total = selectableItems.length
    const checkedCount = selectableItems.filter((item) => selectedPermissionSet.has(item.code)).length

    return {
      total,
      checkedCount,
      checkedAll: total > 0 && checkedCount === total,
      indeterminate: checkedCount > 0 && checkedCount < total,
      moduleKey,
    }
  }

  useEffect(() => {
    if (!safeMode) {
      return
    }

    setSelectedPermissionCodes((current) =>
      current.filter((code) => !isDangerousPermission(code)),
    )
  }, [safeMode])

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
              loading={loadingRoles || loadingRolePermissions}
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
                    void loadRoleApiPermissions(record.code)
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
              loading={loadingMenus || loadingPermissions}
            >
              <Tabs
                defaultActiveKey="menu"
                items={[
                  {
                    key: 'menu',
                    label: 'Quyền Menu',
                    children: (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                          <Typography.Text strong>Tick checkbox để gán menu cho role</Typography.Text>
                          <Space>
                            <Button onClick={openCreateMenu}>Thêm menu</Button>
                            <Button
                              type="primary"
                              onClick={saveRolePermissions}
                              loading={savingPermissions}
                            >
                              Lưu quyền menu
                            </Button>
                          </Space>
                        </Space>

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
                                title: 'Mobile',
                                dataIndex: 'viewMobile',
                                width: 120,
                                render: (value: boolean) =>
                                  value ? <Tag color="green">Hiện mobile</Tag> : <Tag>Ẩn mobile</Tag>,
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
                      </Space>
                    ),
                  },
                  {
                    key: 'api',
                    label: 'Quyền API',
                    children: (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                          <Typography.Text strong>
                            Gán quyền API theo module cho role đang chọn
                          </Typography.Text>
                          <Button
                            type="primary"
                            onClick={saveRoleApiPermissions}
                            loading={savingApiPermissions}
                          >
                            Lưu quyền API
                          </Button>
                        </Space>

                        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Input
                            allowClear
                            value={permissionKeyword}
                            onChange={(event) => setPermissionKeyword(event.target.value)}
                            placeholder="Tìm theo mã quyền hoặc tên quyền"
                            style={{ minWidth: 280 }}
                          />

                          <Space wrap>
                            <Typography.Text>Chế độ an toàn</Typography.Text>
                            <Switch
                              checked={safeMode}
                              onChange={setSafeMode}
                              checkedChildren="Bật"
                              unCheckedChildren="Tắt"
                            />
                            <Button onClick={selectAllApiPermissions}>Chọn tất cả toàn hệ thống</Button>
                            <Button onClick={clearAllApiPermissions}>Bỏ chọn tất cả</Button>
                          </Space>
                        </Space>

                        {safeMode ? (
                          <Typography.Text type="secondary">
                            Chế độ an toàn đang bật: quyền có hậu tố .delete và .restore sẽ bị khóa để tránh cấp nhầm.
                          </Typography.Text>
                        ) : null}

                        {permissionsByModule.length === 0 ? (
                          <Empty description="Chưa có quyền API" />
                        ) : (
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            {permissionsByModule.map((group) => {
                              const stats = moduleStats(group.moduleKey, group.items)

                              return (
                                <Card key={group.moduleKey} size="small" className="permission-card">
                                  <Space
                                    style={{ width: '100%', justifyContent: 'space-between' }}
                                    align="start"
                                  >
                                    <Space direction="vertical" size={0}>
                                      <Typography.Text strong>
                                        Module: {group.moduleKey}
                                      </Typography.Text>
                                      <Typography.Text type="secondary">
                                        Đã chọn {stats.checkedCount}/{stats.total} quyền
                                      </Typography.Text>
                                    </Space>

                                    <Checkbox
                                      checked={stats.checkedAll}
                                      indeterminate={stats.indeterminate}
                                      disabled={stats.total === 0}
                                      onChange={(event) =>
                                        toggleModulePermissions(group.moduleKey, event.target.checked)
                                      }
                                    >
                                      Chọn tất cả module
                                    </Checkbox>
                                  </Space>

                                  <Divider style={{ margin: '12px 0' }} />

                                  <Row gutter={[12, 12]}>
                                    {group.items.map((permission) => (
                                      <Col key={permission.code} xs={24} md={12}>
                                        <Checkbox
                                          checked={selectedPermissionSet.has(permission.code)}
                                          disabled={isPermissionLocked(permission)}
                                          onChange={(event) =>
                                            toggleApiPermission(permission.code, event.target.checked)
                                          }
                                        >
                                          <Space direction="vertical" size={0}>
                                            <Typography.Text strong>{permission.label}</Typography.Text>
                                            <Typography.Text type="secondary">
                                              {permission.code}
                                            </Typography.Text>
                                            {isDangerousPermission(permission.code) ? (
                                              <Tag color={safeMode ? 'orange' : 'red'}>
                                                {safeMode ? 'Nhạy cảm (đang khóa)' : 'Nhạy cảm'}
                                              </Tag>
                                            ) : null}
                                            {permission.moTa ? (
                                              <Typography.Text type="secondary">
                                                {permission.moTa}
                                              </Typography.Text>
                                            ) : null}
                                          </Space>
                                        </Checkbox>
                                      </Col>
                                    ))}
                                  </Row>
                                </Card>
                              )
                            })}
                          </Space>
                        )}
                      </Space>
                    ),
                  },
                ]}
              />
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
        <Form<MenuFormValues>
          form={form}
          layout="vertical"
          initialValues={{ sortOrder: 0, viewMobile: false, isActive: true }}
        >
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

          <Form.Item label="Hiển thị trên mobile" name="viewMobile" valuePropName="checked">
            <Switch checkedChildren="Hiện" unCheckedChildren="Ẩn" />
          </Form.Item>

          <Form.Item label="Trạng thái" name="isActive" valuePropName="checked">
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Khóa" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
