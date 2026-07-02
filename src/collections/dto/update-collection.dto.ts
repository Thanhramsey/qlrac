export class UpdateCollectionDto {
	householdId?: number;
	routeId?: number;
	ngayThuGom?: string;
	trangThai?: 'PENDING' | 'COMPLETED' | 'MISSED';
	ghiChu?: string;
}