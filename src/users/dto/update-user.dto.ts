export class UpdateUserDto {
  taiKhoan?: string;
  matKhau?: string;
  hoVaTen?: string;
  ngaySinh?: string;
  gioiTinh?: string;
  soDienThoai?: string;
  soGiayTo?: string;
  diaChi?: string;
  email?: string;
  role?: 'ADMIN' | 'ADMIN_LEVEL_2' | 'ACCOUNTANT' | 'STAFF';
  isActive?: boolean;
}
