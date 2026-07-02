export class CreateInvoiceDto {
  householdId!: number;
  kyHoaDon!: string;
  tongTien!: string;
  thue!: string;
  trangThaiThanhToan!: 'UNPAID' | 'PAID' | 'OVERDUE';
  hanThanhToan!: string;
}