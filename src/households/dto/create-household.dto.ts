export class CreateHouseholdDto {
  maHoDan!: string;
  tenChuHo!: string;
  diaChi!: string;
  soDienThoai!: string;
  soGiayTo!: string;
  ngayCapGiayTo?: string;
  maSoThue?: string;
  serviceCatalogId?: number;
  tuyenThuRacId!: number;
  isActive?: boolean;
}