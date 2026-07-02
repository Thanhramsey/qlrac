import {
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
import {
  apiClient,
  authTokenStorage,
  clearStoredTokens,
  refreshTokenStorage,
  setTokenRefreshedHandler,
  setUnauthorizedHandler,
} from './api/axios.instance'
import { LoginPage } from './features/login-page'
import { LocationsPage } from './features/locations-page'
import { RolesPage } from './features/roles-page'
import { ServiceCatalogsPage } from './features/service-catalogs-page'
import { UserPermissionsPage } from './features/user-permissions-page'
import { UsersPage } from './features/users-page'
import type { LoginResponse, RoleOption } from './types'
import './App.css'

const { Header, Content, Sider } = Layout
const AUTH_SESSION_KEY = 'auth_session'

function normalizeMenus(menus: LoginResponse['menus']) {
  return (menus ?? [])
    .filter((menu) => Boolean(menu?.key) && Boolean(menu?.label))
    .map((menu) => ({
      ...menu,
      children: (menu.children ?? []).filter(
        (child) => Boolean(child?.key) && Boolean(child?.label),
      ),
    }))
}

function getFirstAvailableMenuKey(menus: LoginResponse['menus']) {
  for (const parent of menus ?? []) {
    if (parent.children && parent.children.length > 0) {
      return parent.children[0].key
    }

    if (parent.key) {
      return parent.key
    }
  }

  return ''
}

function updateStoredAccessToken(accessToken: string) {
  const rawSession = localStorage.getItem(AUTH_SESSION_KEY)
  if (!rawSession) {
    return
  }

  try {
    const parsed = JSON.parse(rawSession) as LoginResponse
    const nextSession: LoginResponse = { ...parsed, accessToken }
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(nextSession))
  } catch {
    localStorage.removeItem(AUTH_SESSION_KEY)
  }
}

function updateStoredRefreshToken(refreshToken: string) {
  const rawSession = localStorage.getItem(AUTH_SESSION_KEY)
  if (!rawSession) {
    return
  }

  try {
    const parsed = JSON.parse(rawSession) as LoginResponse
    const nextSession: LoginResponse = { ...parsed, refreshToken }
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(nextSession))
  } catch {
    localStorage.removeItem(AUTH_SESSION_KEY)
  }
}

function clearAuthState(setSession: (session: LoginResponse | null) => void) {
  clearStoredTokens()
  localStorage.removeItem(AUTH_SESSION_KEY)
  setSession(null)
}

function App() {
  const [session, setSession] = useState<LoginResponse | null>(null)
  const [activeMenuKey, setActiveMenuKey] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const [roles, setRoles] = useState<RoleOption[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)

  useEffect(() => {
    const rawSession = localStorage.getItem(AUTH_SESSION_KEY)
    if (!rawSession) {
      return
    }

    try {
      const parsed = JSON.parse(rawSession) as LoginResponse
      if (parsed?.accessToken && parsed?.refreshToken && parsed?.user && parsed?.menus) {
        const normalizedSession: LoginResponse = {
          ...parsed,
          menus: normalizeMenus(parsed.menus),
        }
        const initialMenuKey = getFirstAvailableMenuKey(normalizedSession.menus)
        authTokenStorage.set(parsed.accessToken)
        refreshTokenStorage.set(parsed.refreshToken)
        setSession(normalizedSession)
        setActiveMenuKey(initialMenuKey)
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(normalizedSession))
      }
    } catch {
      localStorage.removeItem(AUTH_SESSION_KEY)
      clearStoredTokens()
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAuthState(setSession)
      setRoles([])
      setActiveMenuKey('')
      message.warning('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')
    })

    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    setTokenRefreshedHandler(({ accessToken, refreshToken }) => {
      updateStoredAccessToken(accessToken)
      updateStoredRefreshToken(refreshToken)
      setSession((current) =>
        current
          ? {
              ...current,
              accessToken,
              refreshToken,
            }
          : current,
      )
    })

    return () => setTokenRefreshedHandler(null)
  }, [])

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
      const rolesResponse = await apiClient.get<RoleOption[]>('/roles')

      setRoles(rolesResponse.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được dữ liệu quyền')
    } finally {
      setRolesLoading(false)
    }
  }

  useEffect(() => {
    const canManageRoles = session?.menus?.some((parent) =>
      (parent.children ?? []).some((child) =>
        ['users', 'roles', 'user-permissions'].includes(child.key),
      ),
    )

    if (session && canManageRoles) {
      void loadRolesAndPermissions()
      return
    }

    setRoles([])
    setRolesLoading(false)
  }, [session])

  const handleLogin = async (values: {
    taiKhoanOrSoGiayTo: string
    matKhau: string
  }) => {
    setLoginLoading(true)
    setLoginError(null)
    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', values)
      const normalizedSession: LoginResponse = {
        ...response.data,
        menus: normalizeMenus(response.data.menus),
      }
      const initialMenuKey = getFirstAvailableMenuKey(normalizedSession.menus)
      setSession(normalizedSession)
      authTokenStorage.set(normalizedSession.accessToken)
      refreshTokenStorage.set(normalizedSession.refreshToken)
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(normalizedSession))
      setActiveMenuKey(initialMenuKey)
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
          defaultOpenKeys={session?.menus?.map((menu) => menu.key) ?? []}
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
                    clearAuthState(setSession)
                    setRoles([])
                    setActiveMenuKey('')
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
            <RolesPage
              roles={roles}
              loading={rolesLoading}
              onRolesChanged={loadRolesAndPermissions}
            />
          ) : null}
          {!rolesLoading && activeMenuKey === 'user-permissions' ? (
            <UserPermissionsPage roles={roles} />
          ) : null}
          {!rolesLoading && activeMenuKey === 'locations' ? (
            <LocationsPage
              visible={!rolesLoading && activeMenuKey === 'locations'}
              currentUserRole={session.user.role}
            />
          ) : null}
          {!rolesLoading && activeMenuKey === 'service-catalogs' ? <ServiceCatalogsPage /> : null}
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
