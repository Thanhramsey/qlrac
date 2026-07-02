export type UserRole = string

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
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
  expiresIn: string
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
  roleLabel?: string
  routeIds?: number[]
  assignedRoutes?: Array<{
    id: number
    maTuyen: string
    tenTuyen: string
  }>
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
  moTa?: string | null
  isActive?: boolean
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PagedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

export interface ProvinceItem {
  id: number
  maTinh: string
  tenTinh: string
  createdAt: string
  updatedAt: string
}

export interface WardItem {
  id: number
  provinceId: number
  maPhuongXa: string
  tenPhuongXa: string
  province?: {
    id: number
    maTinh: string
    tenTinh: string
  }
  createdAt: string
  updatedAt: string
}

export interface LocalityItem {
  id: number
  wardId: number
  maThonXomTo: string
  tenThonXomTo: string
  ward?: {
    id: number
    maPhuongXa: string
    tenPhuongXa: string
    province?: {
      id: number
      maTinh: string
      tenTinh: string
    }
  }
  createdAt: string
  updatedAt: string
}

export interface RouteItem {
  id: number
  maTuyen: string
  tenTuyen: string
  khuVuc: string
  localityId?: number | null
  staffId?: number | null
  locality?: {
    id: number
    maThonXomTo: string
    tenThonXomTo: string
    ward?: {
      id: number
      maPhuongXa: string
      tenPhuongXa: string
      province?: {
        id: number
        maTinh: string
        tenTinh: string
      }
    }
  } | null
  staff?: {
    id: number
    taiKhoan: string
    hoVaTen: string
    roleCode: string
    isActive?: boolean
  } | null
  createdAt: string
  updatedAt: string
}

export interface ServiceCatalogItem {
  id: number
  maDichVu: string
  tenDichVu: string
  giaDichVu: number
  thuePhanTram: number
  isActive: boolean
  ghiChu?: string | null
  createdAt: string
  updatedAt: string
}

export interface HouseholdItem {
  id: number
  maHoDan: string
  tenChuHo: string
  diaChi: string
  soDienThoai: string
  soGiayTo: string
  ngayCapGiayTo?: string | null
  maSoThue?: string | null
  serviceCatalogId?: number | null
  tuyenThuRacId: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  serviceCatalog?: {
    id: number
    maDichVu: string
    tenDichVu: string
    giaDichVu: number
    thuePhanTram: number
  } | null
  tuyenThuRac?: {
    id: number
    maTuyen: string
    tenTuyen: string
  }
}

export interface MenuItemNode {
  id: number
  menuKey: string
  tenMenu: string
  routePath?: string | null
  parentId?: number | null
  sortOrder: number
  isActive: boolean
  children?: MenuItemNode[]
  parent?: {
    id: number
    menuKey: string
    tenMenu: string
  } | null
}

export interface RoleMenuResponse {
  roleCode: string
  menuIds: number[]
}
