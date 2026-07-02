export type UserRole = 'ADMIN' | 'ADMIN_LEVEL_2' | 'ACCOUNTANT' | 'STAFF'

export interface AppMenuItem {
  key: string
  label: string
  children?: AppMenuItem[]
}

export interface LoginUser {
  id: number
  taiKhoan: string
  hoVaTen: string
  role: UserRole
}

export interface LoginResponse {
  message: string
  user: LoginUser
  menus: AppMenuItem[]
}

export interface UserListItem {
  id: number
  taiKhoan: string
  hoVaTen: string
  ngaySinh?: string | null
  gioiTinh?: string | null
  soDienThoai: string
  soGiayTo: string
  diaChi?: string | null
  email?: string | null
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UserListResponse {
  data: UserListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface RoleOption {
  code: UserRole
  label: string
}
