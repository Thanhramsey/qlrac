import { Injectable } from '@nestjs/common';

@Injectable()
export class RolesService {
  findAll() {
    return [
      { code: 'ADMIN', label: 'Admin' },
      { code: 'ADMIN_LEVEL_2', label: 'Admin mức 2' },
      { code: 'ACCOUNTANT', label: 'Kế toán' },
      { code: 'STAFF', label: 'Nhân viên' },
    ];
  }

  getUserPermissionPlaceholder() {
    return {
      message:
        'Tính năng phân quyền người dùng sẽ phát triển ở giai đoạn tiếp theo',
    };
  }
}
