import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import prismaClientPkg from '@prisma/client';

const { PrismaClient } = prismaClientPkg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Missing DATABASE_URL environment variable');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function upsertRoles() {
  const roles = [
    { code: 'ADMIN', label: 'Quản trị hệ thống' },
    { code: 'ADMIN_LEVEL_2', label: 'Admin mức 2' },
    { code: 'ACCOUNTANT', label: 'Kế toán' },
    { code: 'STAFF', label: 'Nhân viên' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        label: role.label,
        isActive: true,
      },
      create: {
        code: role.code,
        label: role.label,
        isActive: true,
      },
    });
  }
}

async function upsertMenus() {
  const dashboardManagement = await prisma.menu.upsert({
    where: { menuKey: 'dashboard-management' },
    update: {
      tenMenu: 'Dashboard',
      routePath: null,
      parentId: null,
      sortOrder: 5,
      isActive: true,
    },
    create: {
      menuKey: 'dashboard-management',
      tenMenu: 'Dashboard',
      routePath: null,
      parentId: null,
      sortOrder: 5,
      isActive: true,
    },
  });

  const userManagement = await prisma.menu.upsert({
    where: { menuKey: 'user-management' },
    update: {
      tenMenu: 'Quản trị hệ thống',
      routePath: null,
      parentId: null,
      sortOrder: 10,
      isActive: true,
    },
    create: {
      menuKey: 'user-management',
      tenMenu: 'Quản trị hệ thống',
      routePath: null,
      parentId: null,
      sortOrder: 10,
      isActive: true,
    },
  });

  const catalogManagement = await prisma.menu.upsert({
    where: { menuKey: 'catalog-management' },
    update: {
      tenMenu: 'Quản trị danh mục',
      routePath: null,
      parentId: null,
      sortOrder: 20,
      isActive: true,
    },
    create: {
      menuKey: 'catalog-management',
      tenMenu: 'Quản trị danh mục',
      routePath: null,
      parentId: null,
      sortOrder: 20,
      isActive: true,
    },
  });

  const invoiceManagement = await prisma.menu.upsert({
    where: { menuKey: 'invoice-management' },
    update: {
      tenMenu: 'Quản lý hóa đơn',
      routePath: null,
      parentId: null,
      sortOrder: 30,
      isActive: true,
    },
    create: {
      menuKey: 'invoice-management',
      tenMenu: 'Quản lý hóa đơn',
      routePath: null,
      parentId: null,
      sortOrder: 30,
      isActive: true,
    },
  });

  const reportManagement = await prisma.menu.upsert({
    where: { menuKey: 'report-management' },
    update: {
      tenMenu: 'Báo cáo',
      routePath: null,
      parentId: null,
      sortOrder: 40,
      isActive: true,
    },
    create: {
      menuKey: 'report-management',
      tenMenu: 'Báo cáo',
      routePath: null,
      parentId: null,
      sortOrder: 40,
      isActive: true,
    },
  });

  await prisma.menu.upsert({
    where: { menuKey: 'system-parameters' },
    update: {
      tenMenu: 'Tham số hệ thống',
      routePath: '/system-parameters',
      parentId: userManagement.id,
      sortOrder: 40,
      isActive: true,
    },
    create: {
      menuKey: 'system-parameters',
      tenMenu: 'Tham số hệ thống',
      routePath: '/system-parameters',
      parentId: userManagement.id,
      sortOrder: 40,
      isActive: true,
    },
  });

  const childMenus = [
    {
      menuKey: 'dashboard-overview',
      tenMenu: 'Tổng quan đơn vị',
      routePath: '/dashboard',
      sortOrder: 10,
      parentId: dashboardManagement.id,
    },
    {
      menuKey: 'users',
      tenMenu: 'Danh sách người dùng',
      routePath: '/users',
      sortOrder: 10,
      parentId: userManagement.id,
    },
    {
      menuKey: 'households',
      tenMenu: 'Quản lý hộ dân',
      routePath: '/households',
      sortOrder: 15,
      parentId: userManagement.id,
    },
    {
      menuKey: 'roles',
      tenMenu: 'Quản lý quyền',
      routePath: '/roles',
      sortOrder: 20,
      parentId: userManagement.id,
    },
    {
      menuKey: 'user-permissions',
      tenMenu: 'Phân quyền người dùng',
      routePath: '/user-permissions',
      sortOrder: 30,
      parentId: userManagement.id,
    },
    {
      menuKey: 'locations',
      tenMenu: 'Quản lý địa danh',
      routePath: '/locations',
      sortOrder: 10,
      parentId: catalogManagement.id,
    },
    {
      menuKey: 'service-catalogs',
      tenMenu: 'Danh mục dịch vụ',
      routePath: '/service-catalogs',
      sortOrder: 20,
      parentId: catalogManagement.id,
    },
    {
      menuKey: 'billing-periods',
      tenMenu: 'Quản lý kỳ hóa đơn',
      routePath: '/billing-periods',
      sortOrder: 30,
      parentId: catalogManagement.id,
    },
    {
      menuKey: 'invoice-collections',
      tenMenu: 'Quản lý thu tiền',
      routePath: '/invoice-collections',
      sortOrder: 10,
      parentId: invoiceManagement.id,
    },
    {
      menuKey: 'reports-detail-period',
      tenMenu: 'Báo cáo chi tiết theo kỳ',
      routePath: '/reports/detail-by-period',
      sortOrder: 10,
      parentId: reportManagement.id,
    },
    {
      menuKey: 'reports-detail-date',
      tenMenu: 'Báo cáo chi tiết theo ngày',
      routePath: '/reports/detail-by-date',
      sortOrder: 20,
      parentId: reportManagement.id,
    },
    {
      menuKey: 'reports-revenue-summary',
      tenMenu: 'Báo cáo tổng hợp doanh số',
      routePath: '/reports/revenue-summary',
      sortOrder: 30,
      parentId: reportManagement.id,
    },
  ];

  for (const menu of childMenus) {
    await prisma.menu.upsert({
      where: { menuKey: menu.menuKey },
      update: {
        tenMenu: menu.tenMenu,
        routePath: menu.routePath,
        parentId: menu.parentId,
        sortOrder: menu.sortOrder,
        isActive: true,
      },
      create: {
        menuKey: menu.menuKey,
        tenMenu: menu.tenMenu,
        routePath: menu.routePath,
        parentId: menu.parentId,
        sortOrder: menu.sortOrder,
        isActive: true,
      },
    });
  }
}

async function assignRoleMenus() {
  const allMenus = await prisma.menu.findMany({ where: { isActive: true } });
  const menuIdByKey = new Map(allMenus.map((item) => [item.menuKey, item.id]));

  const roleAssignments = {
    ADMIN: allMenus.map((item) => item.id),
    ADMIN_LEVEL_2: allMenus
      .filter((item) => !['roles', 'user-permissions'].includes(item.menuKey))
      .map((item) => item.id),
    STAFF: [
      'dashboard-management',
      'dashboard-overview',
      'user-management',
      'households',
      'catalog-management',
      'locations',
      'invoice-management',
      'invoice-collections',
      'report-management',
      'reports-detail-period',
      'reports-detail-date',
      'reports-revenue-summary',
    ]
      .map((key) => menuIdByKey.get(key))
      .filter((id) => Number.isInteger(id)),
    ACCOUNTANT: [
      'dashboard-management',
      'dashboard-overview',
      'catalog-management',
      'service-catalogs',
      'billing-periods',
      'invoice-management',
      'invoice-collections',
      'report-management',
      'reports-detail-period',
      'reports-detail-date',
      'reports-revenue-summary',
    ]
      .map((key) => menuIdByKey.get(key))
      .filter((id) => Number.isInteger(id)),
  };

  for (const [roleCode, menuIds] of Object.entries(roleAssignments)) {
    await prisma.roleMenuPermission.deleteMany({ where: { roleCode } });

    if (menuIds.length > 0) {
      await prisma.roleMenuPermission.createMany({
        data: menuIds.map((menuId) => ({
          roleCode,
          menuId,
        })),
        skipDuplicates: true,
      });
    }
  }
}

async function upsertLocationsAndRoutes() {
  const province = await prisma.province.upsert({
    where: { maTinh: 'DN' },
    update: { tenTinh: 'Đà Nẵng' },
    create: { maTinh: 'DN', tenTinh: 'Đà Nẵng' },
  });

  const wardAnKhe = await prisma.ward.upsert({
    where: {
      provinceId_maPhuongXa: {
        provinceId: province.id,
        maPhuongXa: 'ANKHE',
      },
    },
    update: { tenPhuongXa: 'An Khê' },
    create: {
      provinceId: province.id,
      maPhuongXa: 'ANKHE',
      tenPhuongXa: 'An Khê',
    },
  });

  const wardHoaKhe = await prisma.ward.upsert({
    where: {
      provinceId_maPhuongXa: {
        provinceId: province.id,
        maPhuongXa: 'HOAKHE',
      },
    },
    update: { tenPhuongXa: 'Hòa Khê' },
    create: {
      provinceId: province.id,
      maPhuongXa: 'HOAKHE',
      tenPhuongXa: 'Hòa Khê',
    },
  });

  const locality1 = await prisma.locality.upsert({
    where: {
      wardId_maThonXomTo: {
        wardId: wardAnKhe.id,
        maThonXomTo: 'TO-01',
      },
    },
    update: { tenThonXomTo: 'Tổ dân phố 01' },
    create: {
      wardId: wardAnKhe.id,
      maThonXomTo: 'TO-01',
      tenThonXomTo: 'Tổ dân phố 01',
    },
  });

  const locality2 = await prisma.locality.upsert({
    where: {
      wardId_maThonXomTo: {
        wardId: wardHoaKhe.id,
        maThonXomTo: 'TO-05',
      },
    },
    update: { tenThonXomTo: 'Tổ dân phố 05' },
    create: {
      wardId: wardHoaKhe.id,
      maThonXomTo: 'TO-05',
      tenThonXomTo: 'Tổ dân phố 05',
    },
  });

  await prisma.route.upsert({
    where: { maTuyen: 'RT-001' },
    update: {
      tenTuyen: 'Tuyến An Khê 1',
      khuVuc: 'Khu vực An Khê',
      localityId: locality1.id,
    },
    create: {
      maTuyen: 'RT-001',
      tenTuyen: 'Tuyến An Khê 1',
      khuVuc: 'Khu vực An Khê',
      localityId: locality1.id,
    },
  });

  await prisma.route.upsert({
    where: { maTuyen: 'RT-002' },
    update: {
      tenTuyen: 'Tuyến Hòa Khê 1',
      khuVuc: 'Khu vực Hòa Khê',
      localityId: locality2.id,
    },
    create: {
      maTuyen: 'RT-002',
      tenTuyen: 'Tuyến Hòa Khê 1',
      khuVuc: 'Khu vực Hòa Khê',
      localityId: locality2.id,
    },
  });
}

async function upsertServiceCatalogs() {
  const services = [
    {
      maDichVu: 'DV-SH',
      tenDichVu: 'Thu gom rác sinh hoạt',
      giaDichVu: 120000,
      thuePhanTram: 0,
      isActive: true,
      ghiChu: 'Áp dụng hộ dân thông thường',
    },
    {
      maDichVu: 'DV-TC',
      tenDichVu: 'Thu gom rác tổ chức',
      giaDichVu: 150000,
      thuePhanTram: 10,
      isActive: true,
      ghiChu: 'Áp dụng cơ sở kinh doanh/tổ chức',
    },
  ];

  for (const service of services) {
    await prisma.serviceCatalog.upsert({
      where: { maDichVu: service.maDichVu },
      update: {
        tenDichVu: service.tenDichVu,
        giaDichVu: service.giaDichVu,
        thuePhanTram: service.thuePhanTram,
        isActive: service.isActive,
        ghiChu: service.ghiChu,
      },
      create: service,
    });
  }
}

async function upsertUsers() {
  const defaultPasswordHash = await bcrypt.hash('123456', 10);

  const users = [
    {
      taiKhoan: 'admin01',
      hoVaTen: 'Quản trị hệ thống',
      soDienThoai: '0900000001',
      soGiayTo: '079200000001',
      roleCode: 'ADMIN',
      email: 'admin01@example.com',
    },
    {
      taiKhoan: 'adminlv2',
      hoVaTen: 'Admin mức 2',
      soDienThoai: '0900000002',
      soGiayTo: '079200000002',
      roleCode: 'ADMIN_LEVEL_2',
      email: 'adminlv2@example.com',
    },
    {
      taiKhoan: 'staff01',
      hoVaTen: 'Nhân viên tuyến 01',
      soDienThoai: '0900000003',
      soGiayTo: '079200000003',
      roleCode: 'STAFF',
      email: 'staff01@example.com',
    },
    {
      taiKhoan: 'account01',
      hoVaTen: 'Kế toán 01',
      soDienThoai: '0900000004',
      soGiayTo: '079200000004',
      roleCode: 'ACCOUNTANT',
      email: 'account01@example.com',
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { taiKhoan: user.taiKhoan },
      update: {
        hoVaTen: user.hoVaTen,
        soDienThoai: user.soDienThoai,
        soGiayTo: user.soGiayTo,
        roleCode: user.roleCode,
        isActive: true,
        email: user.email,
        matKhauHash: defaultPasswordHash,
      },
      create: {
        taiKhoan: user.taiKhoan,
        matKhauHash: defaultPasswordHash,
        hoVaTen: user.hoVaTen,
        soDienThoai: user.soDienThoai,
        soGiayTo: user.soGiayTo,
        roleCode: user.roleCode,
        isActive: true,
        email: user.email,
      },
    });
  }

  const staff = await prisma.user.findUnique({ where: { taiKhoan: 'staff01' } });
  const route1 = await prisma.route.findUnique({ where: { maTuyen: 'RT-001' } });
  const route2 = await prisma.route.findUnique({ where: { maTuyen: 'RT-002' } });

  if (staff && route1 && route2) {
    await prisma.route.update({
      where: { id: route1.id },
      data: { staffId: staff.id },
    });

    await prisma.user.update({
      where: { id: staff.id },
      data: {
        assignedRoutes: {
          set: [{ id: route1.id }, { id: route2.id }],
        },
      },
    });
  }
}

async function upsertHouseholds() {
  const route1 = await prisma.route.findUnique({ where: { maTuyen: 'RT-001' } });
  const route2 = await prisma.route.findUnique({ where: { maTuyen: 'RT-002' } });
  const serviceSinhHoat = await prisma.serviceCatalog.findUnique({ where: { maDichVu: 'DV-SH' } });
  const serviceToChuc = await prisma.serviceCatalog.findUnique({ where: { maDichVu: 'DV-TC' } });

  if (!route1 || !route2) {
    return;
  }

  await prisma.household.upsert({
    where: { maHoDan: 'HD-0001' },
    update: {
      tenChuHo: 'Nguyễn Văn An',
      diaChi: 'Tổ dân phố 01, An Khê, Đà Nẵng',
      soDienThoai: '0911000001',
      soGiayTo: '201000000001',
      ngayCapGiayTo: new Date('2020-05-10'),
      maSoThue: '0401999001',
      serviceCatalogId: serviceSinhHoat?.id ?? null,
      tuyenThuRacId: route1.id,
      isActive: true,
    },
    create: {
      maHoDan: 'HD-0001',
      tenChuHo: 'Nguyễn Văn An',
      diaChi: 'Tổ dân phố 01, An Khê, Đà Nẵng',
      soDienThoai: '0911000001',
      soGiayTo: '201000000001',
      ngayCapGiayTo: new Date('2020-05-10'),
      maSoThue: '0401999001',
      serviceCatalogId: serviceSinhHoat?.id ?? null,
      tuyenThuRacId: route1.id,
      isActive: true,
    },
  });

  await prisma.household.upsert({
    where: { maHoDan: 'HD-0002' },
    update: {
      tenChuHo: 'Công ty Môi Trường Xanh',
      diaChi: 'Tổ dân phố 05, Hòa Khê, Đà Nẵng',
      soDienThoai: '0911000002',
      soGiayTo: '031000000002',
      ngayCapGiayTo: new Date('2021-03-12'),
      maSoThue: '0402999002',
      serviceCatalogId: serviceToChuc?.id ?? null,
      tuyenThuRacId: route2.id,
      isActive: true,
    },
    create: {
      maHoDan: 'HD-0002',
      tenChuHo: 'Công ty Môi Trường Xanh',
      diaChi: 'Tổ dân phố 05, Hòa Khê, Đà Nẵng',
      soDienThoai: '0911000002',
      soGiayTo: '031000000002',
      ngayCapGiayTo: new Date('2021-03-12'),
      maSoThue: '0402999002',
      serviceCatalogId: serviceToChuc?.id ?? null,
      tuyenThuRacId: route2.id,
      isActive: true,
    },
  });
}

async function upsertBillingPeriods() {
  await prisma.billingPeriodConfig.upsert({
    where: { id: 1 },
    update: {
      autoCreateEnabled: true,
    },
    create: {
      id: 1,
      autoCreateEnabled: true,
    },
  });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const maKy = `${year}-${String(month + 1).padStart(2, '0')}`;
  const tenKy = `Kỳ ${String(month + 1).padStart(2, '0')}/${year}`;

  await prisma.billingPeriod.upsert({
    where: { maKy },
    update: {
      tenKy,
      ngayBatDau: start,
      ngayKetThuc: end,
      isClosed: false,
    },
    create: {
      maKy,
      tenKy,
      ngayBatDau: start,
      ngayKetThuc: end,
      isClosed: false,
      isAutoGenerated: true,
    },
  });
}

async function upsertSystemParameters() {
  const defaults = [
    'Tên đơn vị',
    'Mã số thuế',
    'Số điện thoại',
    'Địa chỉ',
    'Số tài khoản ngân hàng',
    'Người đại diện',
    'Mẫu số hóa đơn',
    'Ký hiệu hóa đơn',
    'PUBLISH_SERVICE_ADDRESS_ID',
    'BUSINESS_SERVICE_ADDRESS_ID',
    'PORTAL_SERVICE_ADDRESS_ID',
    'C_PASSWORD_ID',
    'C_USER_ID',
    'WS_PASSWORD_ID',
    'WS_USER_ID',
  ];

  for (const tenThamSo of defaults) {
    await prisma.systemParameter.upsert({
      where: { tenThamSo },
      update: {},
      create: {
        tenThamSo,
        giaTri: '',
      },
    });
  }
}

async function main() {
  console.log('Start seeding...');

  await upsertRoles();
  await upsertMenus();
  await assignRoleMenus();
  await upsertLocationsAndRoutes();
  await upsertServiceCatalogs();
  await upsertUsers();
  await upsertHouseholds();
  await upsertBillingPeriods();
  await upsertSystemParameters();

  console.log('Seeding completed.');
  console.log('Default accounts (password: 123456): admin01, adminlv2, staff01, account01');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
