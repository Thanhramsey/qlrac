export class CreateUserDto {
  taiKhoan!: string;
  matKhau!: string;
  hoVaTen!: string;
  ngaySinh?: string;
  gioiTinh?: string;
  soDienThoai!: string;
  soGiayTo!: string;
  diaChi?: string;
  email?: string;
  role?: string;
  routeIds?: number[];
}
