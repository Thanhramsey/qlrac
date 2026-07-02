export class UpdateHouseholdDto {
	maHoDan?: string;
	tenChuHo?: string;
	diaChi?: string;
	soDienThoai?: string;
	soGiayTo?: string;
	ngayCapGiayTo?: string | null;
	maSoThue?: string | null;
	serviceCatalogId?: number | null;
	tuyenThuRacId?: number;
	isActive?: boolean;
}