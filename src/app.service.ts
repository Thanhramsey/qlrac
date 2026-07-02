import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      status: 'Hệ thống đang hoạt động ổn định',
      project: 'Hệ thống Quản lý Thu rác & Hóa đơn điện tử',
      version: '1.0.0 (NestJS + PostgreSQL 17)',
      author: 'Thành Trịnh',
      metrics: {
        total_customers: 30000,
        pending_invoices: 1250,
        active_staff: 45
      }
    };
  }
}