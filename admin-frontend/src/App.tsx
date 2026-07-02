import {
  Alert,
  Avatar,
  Dropdown,
  Layout,
  Menu,
  Spin,
  Space,
  Typography,
  message,
} from 'antd'
import { TeamOutlined, UserSwitchOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { apiClient } from './api/axios.instance'
import { LoginPage } from './features/login-page'
import { RolesPage } from './features/roles-page'
import { UsersPage } from './features/users-page'
import type { LoginResponse, RoleOption } from './types'
import './App.css'

const { Header, Content, Sider } = Layout

function App() {
  const [session, setSession] = useState<LoginResponse | null>(null)
  const [activeMenuKey, setActiveMenuKey] = useState('users')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const [roles, setRoles] = useState<RoleOption[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [permissionsMessage, setPermissionsMessage] = useState('')

  const parentMenus = useMemo(
    () =>
      session?.menus?.map((menu) => ({
        key: menu.key,
        icon: <TeamOutlined />,
        label: menu.label,
        children:
          menu.children?.map((child) => ({
            key: child.key,
            label: child.label,
          })) ?? [],
      })) ?? [],
    [session],
  )

  const loadRolesAndPermissions = async () => {
    setRolesLoading(true)
    try {
      const [rolesResponse, permissionsResponse] = await Promise.all([
        apiClient.get<RoleOption[]>('/roles'),
        apiClient.get<{ message: string }>('/roles/user-permissions'),
      ])

      setRoles(rolesResponse.data)
      setPermissionsMessage(permissionsResponse.data.message)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được dữ liệu quyền')
    } finally {
      setRolesLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      void loadRolesAndPermissions()
    }
  }, [session])

  const handleLogin = async (values: {
    taiKhoanOrSoGiayTo: string
    matKhau: string
  }) => {
    setLoginLoading(true)
    setLoginError(null)
    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', values)
      setSession(response.data)
      setActiveMenuKey('users')
      message.success('Đăng nhập thành công')
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Đăng nhập thất bại')
    } finally {
      setLoginLoading(false)
    }
  }

  if (!session) {
    return (
      <LoginPage
        loading={loginLoading}
        errorMessage={loginError}
        onSubmit={handleLogin}
      />
    )
  }

  return (
    <Layout className="app-shell">
      <Sider breakpoint="lg" collapsedWidth="0" width={280} className="app-sider">
        <div className="brand-block">
          <Typography.Title level={4}>Ban Quản lý phường An Khê</Typography.Title>
          <Typography.Text>Trang quản trị hệ thống</Typography.Text>
        </div>

        <Menu
          mode="inline"
          className="side-menu"
          items={parentMenus}
          selectedKeys={[activeMenuKey]}
          defaultOpenKeys={['user-management']}
          onClick={({ key }) => setActiveMenuKey(key)}
        />
      </Sider>

      <Layout>
        <Header className="app-header">
          <Space>
            <UserSwitchOutlined />
            <Typography.Text strong>
              Chào, {session.user.hoVaTen} ({session.user.taiKhoan})
            </Typography.Text>
          </Space>

          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  label: 'Đăng xuất',
                  onClick: () => {
                    setSession(null)
                    setRoles([])
                    setActiveMenuKey('users')
                  },
                },
              ],
            }}
          >
            <Avatar style={{ backgroundColor: '#214d60', cursor: 'pointer' }}>
              {session.user.hoVaTen.slice(0, 1).toUpperCase()}
            </Avatar>
          </Dropdown>
        </Header>

        <Content className="app-content">
          {rolesLoading ? (
            <div className="loading-panel">
              <Spin size="large" />
            </div>
          ) : null}

          {!rolesLoading && activeMenuKey === 'users' ? <UsersPage roles={roles} /> : null}
          {!rolesLoading && activeMenuKey === 'roles' ? (
            <RolesPage roles={roles} loading={rolesLoading} />
          ) : null}
          {!rolesLoading && activeMenuKey === 'user-permissions' ? (
            <Alert
              type="info"
              showIcon
              message="Phân quyền người dùng"
              description={permissionsMessage}
              className="page-card"
            />
          ) : null}
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
