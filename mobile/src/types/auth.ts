export interface LoginUser {
  id: number;
  taiKhoan: string;
  hoVaTen: string;
  role: string;
  avatarUrl?: string | null;
}

export interface AppMenuItem {
  key: string;
  label: string;
  routePath?: string;
  viewMobile?: boolean;
  children?: AppMenuItem[];
}

export interface LoginResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: LoginUser;
  menus: AppMenuItem[];
}
