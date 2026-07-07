import {
  Avatar,
  Button,
  Dropdown,
  Form,
  Input,
  Layout,
  Menu,
  Modal,
  Spin,
  Space,
  Tabs,
  Typography,
  Upload,
  message,
} from 'antd'
import {
  DownOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
  TeamOutlined,
  UploadOutlined,
  UserOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import {
  apiClient,
  authTokenStorage,
  clearStoredTokens,
  refreshTokenStorage,
  setTokenRefreshedHandler,
  setUnauthorizedHandler,
} from './api/axios.instance'
import { resolveMediaUrl } from './api/media-url'
import { LoginPage } from './features/login-page'
import { LocationsPage } from './features/locations-page'
import { HouseholdsPage } from './features/households-page'
import { InvoiceCollectionsPage } from './features/invoice-collections-page'
import BillingPeriodsPage from './features/billing-periods-page'
import { RolesPage } from './features/roles-page'
import { ServiceCatalogsPage } from './features/service-catalogs-page'
import { SystemParametersPage } from './features/system-parameters-page'
import { UserPermissionsPage } from './features/user-permissions-page'
import { UsersPage } from './features/users-page'
import { ReportsPage } from './features/reports-page'
import { DashboardPage } from './features/dashboard-page'
import type { LoginResponse, RoleOption, UserListItem } from './types'
import './App.css'

const { Header, Content, Sider } = Layout
const AUTH_SESSION_KEY = 'auth_session'

type ProfileFormValues = {
  hoVaTen: string
  soDienThoai: string
  email?: string
  diaChi?: string
  ngaySinh?: string
  gioiTinh?: string
}

type PasswordFormValues = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

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

function updateStoredUser(userPatch: Partial<LoginResponse['user']>) {
  const rawSession = localStorage.getItem(AUTH_SESSION_KEY)
  if (!rawSession) {
    return
  }

  try {
    const parsed = JSON.parse(rawSession) as LoginResponse
    const nextSession: LoginResponse = {
      ...parsed,
      user: {
        ...parsed.user,
        ...userPatch,
      },
    }
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(nextSession))
  } catch {
    localStorage.removeItem(AUTH_SESSION_KEY)
  }
}

function toDateInputValue(value?: string | null) {
  if (!value) {
    return undefined
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
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
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [profileForm] = Form.useForm<ProfileFormValues>()
  const [passwordForm] = Form.useForm<PasswordFormValues>()

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

  const applyProfileToSession = (profile: UserListItem) => {
    setSession((current) =>
      current
        ? {
            ...current,
            user: {
              ...current.user,
              hoVaTen: profile.hoVaTen,
              avatarUrl: profile.avatarUrl,
            },
          }
        : current,
    )
    updateStoredUser({
      hoVaTen: profile.hoVaTen,
      avatarUrl: profile.avatarUrl,
    })
  }

  const fetchMyProfile = async () => {
    setProfileLoading(true)
    try {
      const response = await apiClient.get<UserListItem>('/users/me')
      const profile = response.data

      profileForm.setFieldsValue({
        hoVaTen: profile.hoVaTen,
        soDienThoai: profile.soDienThoai,
        email: profile.email ?? undefined,
        diaChi: profile.diaChi ?? undefined,
        gioiTinh: profile.gioiTinh ?? undefined,
        ngaySinh: toDateInputValue(profile.ngaySinh),
      })

      applyProfileToSession(profile)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được thông tin cá nhân')
    } finally {
      setProfileLoading(false)
    }
  }

  const handleOpenProfileModal = async () => {
    setProfileModalOpen(true)
    passwordForm.resetFields()
    await fetchMyProfile()
  }

  const handleUpdateProfile = async (values: ProfileFormValues) => {
    setProfileSaving(true)
    try {
      const response = await apiClient.patch<UserListItem>('/users/me', values)
      applyProfileToSession(response.data)
      message.success('Cập nhật thông tin cá nhân thành công')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không cập nhật được thông tin cá nhân')
    } finally {
      setProfileSaving(false)
    }
  }

  const performLogout = async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // Ignore logout API error and clear local session to ensure user is logged out.
    }

    clearAuthState(setSession)
    setRoles([])
    setActiveMenuKey('')
    setProfileModalOpen(false)
  }

  const handleUpdatePassword = async (values: PasswordFormValues) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('Xác nhận mật khẩu mới không khớp')
      return
    }

    setPasswordSaving(true)
    try {
      await apiClient.patch('/users/me/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      message.success('Đổi mật khẩu thành công, vui lòng đăng nhập lại')
      await performLogout()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không đổi được mật khẩu')
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleAvatarUpload = async (options: {
    file: File
    onSuccess?: (response: unknown) => void
    onError?: (error: Error) => void
  }) => {
    setAvatarUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', options.file)
      const response = await apiClient.post<UserListItem>('/users/me/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      applyProfileToSession(response.data)
      message.success('Cập nhật avatar thành công')
      options.onSuccess?.(response.data)
    } catch (error) {
      const uploadError = error instanceof Error ? error : new Error('Không tải lên được avatar')
      message.error(uploadError.message)
      options.onError?.(uploadError)
    } finally {
      setAvatarUploading(false)
    }
  }

  useEffect(() => {
    const canManageRoles = session?.menus?.some((parent) =>
      (parent.children ?? []).some((child) =>
        ['users', 'roles', 'user-permissions', 'households'].includes(child.key),
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
          <Space className="header-user-greeting">
            <UserSwitchOutlined />
            <Typography.Text strong>
              Chào, {session.user.hoVaTen} ({session.user.taiKhoan})
            </Typography.Text>
          </Space>

          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'profile',
                  icon: <InfoCircleOutlined />,
                  label: 'Thông tin',
                },
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: 'Đăng xuất',
                },
              ],
              onClick: ({ key }) => {
                if (key === 'profile') {
                  void handleOpenProfileModal()
                  return
                }

                if (key === 'logout') {
                  void performLogout()
                }
              },
            }}
          >
            <div className="user-dropdown-trigger">
              <Avatar
                size={40}
                src={resolveMediaUrl(session.user.avatarUrl)}
                icon={<UserOutlined />}
              />
              <div className="user-dropdown-meta">
                <Typography.Text strong>{session.user.hoVaTen}</Typography.Text>
                <Typography.Text type="secondary">{session.user.taiKhoan}</Typography.Text>
              </div>
              <DownOutlined />
            </div>
          </Dropdown>
        </Header>

        <Content className="app-content">
          {rolesLoading ? (
            <div className="loading-panel">
              <Spin size="large" />
            </div>
          ) : null}

          {!rolesLoading && (activeMenuKey === 'dashboard-overview' || activeMenuKey === 'dashboard-management') ? (
            <DashboardPage />
          ) : null}
          {!rolesLoading && activeMenuKey === 'users' ? <UsersPage roles={roles} /> : null}
          {!rolesLoading && activeMenuKey === 'households' ? <HouseholdsPage /> : null}
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
          {!rolesLoading && activeMenuKey === 'system-parameters' ? <SystemParametersPage /> : null}
          {!rolesLoading && activeMenuKey === 'billing-periods' ? <BillingPeriodsPage /> : null}
          {!rolesLoading && activeMenuKey === 'invoice-collections' ? <InvoiceCollectionsPage /> : null}
          {!rolesLoading && (activeMenuKey === 'reports' || activeMenuKey === 'reports-detail-period') ? (
            <ReportsPage initialTab="detail-by-period" />
          ) : null}
          {!rolesLoading && activeMenuKey === 'reports-detail-date' ? (
            <ReportsPage initialTab="detail-by-date" />
          ) : null}
          {!rolesLoading && activeMenuKey === 'reports-revenue-summary' ? (
            <ReportsPage initialTab="revenue-summary" />
          ) : null}
        </Content>
      </Layout>

      <Modal
        open={profileModalOpen}
        title="Thông tin cá nhân"
        width={680}
        onCancel={() => setProfileModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <div className="profile-modal-avatar-row">
          <Avatar
            size={72}
            src={resolveMediaUrl(session.user.avatarUrl)}
            icon={<UserOutlined />}
          />
          <Upload
            accept="image/*"
            showUploadList={false}
            customRequest={({ file, onSuccess, onError }) => {
              void handleAvatarUpload({
                file: file as File,
                onSuccess: (data) => onSuccess?.(data),
                onError: (error) => onError?.(error as unknown as Error),
              })
            }}
          >
            <Typography.Link>
              <UploadOutlined /> {avatarUploading ? 'Đang tải...' : 'Tải ảnh avatar'}
            </Typography.Link>
          </Upload>
        </div>

        {profileLoading ? (
          <div className="loading-panel" style={{ height: 220 }}>
            <Spin />
          </div>
        ) : (
          <Tabs
            items={[
              {
                key: 'profile-info',
                label: 'Thông tin cá nhân',
                children: (
                  <Form layout="vertical" form={profileForm} onFinish={handleUpdateProfile}>
                    <div className="form-grid">
                      <Form.Item
                        label="Họ và tên"
                        name="hoVaTen"
                        rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
                      >
                        <Input placeholder="Nguyễn Văn A" />
                      </Form.Item>
                      <Form.Item
                        label="Số điện thoại"
                        name="soDienThoai"
                        rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
                      >
                        <Input placeholder="09xxxxxxxx" />
                      </Form.Item>
                      <Form.Item label="Email" name="email">
                        <Input placeholder="abc@gmail.com" />
                      </Form.Item>
                      <Form.Item label="Giới tính" name="gioiTinh">
                        <Input placeholder="Nam/Nữ/Khác" />
                      </Form.Item>
                      <Form.Item label="Ngày sinh" name="ngaySinh">
                        <Input type="date" />
                      </Form.Item>
                      <Form.Item className="full-col" label="Địa chỉ" name="diaChi">
                        <Input placeholder="Số nhà, đường, tổ dân phố" />
                      </Form.Item>
                    </div>

                    <Space>
                      <Button type="primary" htmlType="submit" loading={profileSaving}>
                        Lưu thông tin
                      </Button>
                    </Space>
                  </Form>
                ),
              },
              {
                key: 'profile-password',
                label: 'Đổi mật khẩu',
                children: (
                  <Form layout="vertical" form={passwordForm} onFinish={handleUpdatePassword}>
                    <Form.Item
                      label="Mật khẩu hiện tại"
                      name="currentPassword"
                      rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
                    >
                      <Input.Password />
                    </Form.Item>
                    <Form.Item
                      label="Mật khẩu mới"
                      name="newPassword"
                      rules={[
                        { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                        { min: 6, message: 'Mật khẩu mới tối thiểu 6 ký tự' },
                      ]}
                    >
                      <Input.Password />
                    </Form.Item>
                    <Form.Item
                      label="Xác nhận mật khẩu mới"
                      name="confirmPassword"
                      rules={[{ required: true, message: 'Vui lòng xác nhận mật khẩu mới' }]}
                    >
                      <Input.Password />
                    </Form.Item>

                    <Button type="primary" htmlType="submit" loading={passwordSaving}>
                      Cập nhật mật khẩu
                    </Button>
                  </Form>
                ),
              },
            ]}
          />
        )}
      </Modal>
    </Layout>
  )
}

export default App
