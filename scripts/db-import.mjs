import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Missing DATABASE_URL environment variable');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function toDate(value) {
  return value ? new Date(value) : null;
}

function toDecimal(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  return value;
}

async function resolveInputPath() {
  const argPath = process.argv[2];
  if (argPath) {
    return path.resolve(process.cwd(), argPath);
  }

  const backupDir = path.resolve(process.cwd(), 'backups');
  const files = await readdir(backupDir);
  const matched = files
    .filter((item) => /^db-export-\d{8}-\d{6}\.json$/.test(item))
    .sort((a, b) => b.localeCompare(a));

  if (matched.length === 0) {
    throw new Error('Không tìm thấy file backup trong thư mục backups/');
  }

  return path.join(backupDir, matched[0]);
}

async function resetSequences() {
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('provinces','id'), COALESCE((SELECT MAX(id) FROM provinces), 1), true)`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('wards','id'), COALESCE((SELECT MAX(id) FROM wards), 1), true)`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('localities','id'), COALESCE((SELECT MAX(id) FROM localities), 1), true)`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('service_catalogs','id'), COALESCE((SELECT MAX(id) FROM service_catalogs), 1), true)`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('users','id'), COALESCE((SELECT MAX(id) FROM users), 1), true)`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('routes','id'), COALESCE((SELECT MAX(id) FROM routes), 1), true)`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('households','id'), COALESCE((SELECT MAX(id) FROM households), 1), true)`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('collections','id'), COALESCE((SELECT MAX(id) FROM collections), 1), true)`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('invoices','id'), COALESCE((SELECT MAX(id) FROM invoices), 1), true)`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('billing_periods','id'), COALESCE((SELECT MAX(id) FROM billing_periods), 1), true)`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('billing_period_configs','id'), COALESCE((SELECT MAX(id) FROM billing_period_configs), 1), true)`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('menus','id'), COALESCE((SELECT MAX(id) FROM menus), 1), true)`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('system_parameters','id'), COALESCE((SELECT MAX(id) FROM system_parameters), 1), true)`);
}

async function main() {
  const inputPath = await resolveInputPath();
  const raw = await readFile(inputPath, 'utf-8');
  const payload = JSON.parse(raw);
  const tables = payload.tables ?? {};

  await prisma.$transaction(async (tx) => {
    await tx.roleMenuPermission.deleteMany();
    await tx.collection.deleteMany();
    await tx.invoice.deleteMany();
    await tx.household.deleteMany();
    await tx.route.deleteMany();
    await tx.user.deleteMany();
    await tx.menu.deleteMany();
    await tx.systemParameter.deleteMany();
    await tx.billingPeriodConfig.deleteMany();
    await tx.billingPeriod.deleteMany();
    await tx.serviceCatalog.deleteMany();
    await tx.locality.deleteMany();
    await tx.ward.deleteMany();
    await tx.province.deleteMany();
    await tx.role.deleteMany();

    if (tables.role?.length) {
      await tx.role.createMany({ data: tables.role });
    }

    if (tables.province?.length) {
      await tx.province.createMany({ data: tables.province });
    }

    if (tables.ward?.length) {
      await tx.ward.createMany({ data: tables.ward });
    }

    if (tables.locality?.length) {
      await tx.locality.createMany({ data: tables.locality });
    }

    if (tables.serviceCatalog?.length) {
      await tx.serviceCatalog.createMany({
        data: tables.serviceCatalog.map((item) => ({
          ...item,
          giaDichVu: toDecimal(item.giaDichVu),
          thuePhanTram: toDecimal(item.thuePhanTram),
          createdAt: toDate(item.createdAt),
          updatedAt: toDate(item.updatedAt),
        })),
      });
    }

    if (tables.user?.length) {
      await tx.user.createMany({
        data: tables.user.map((item) => ({
          ...item,
          ngaySinh: toDate(item.ngaySinh),
          createdAt: toDate(item.createdAt),
          updatedAt: toDate(item.updatedAt),
        })),
      });
    }

    if (tables.route?.length) {
      await tx.route.createMany({
        data: tables.route.map((item) => ({
          ...item,
          createdAt: toDate(item.createdAt),
          updatedAt: toDate(item.updatedAt),
        })),
      });
    }

    if (tables.household?.length) {
      await tx.household.createMany({
        data: tables.household.map((item) => ({
          ...item,
          ngayCapGiayTo: toDate(item.ngayCapGiayTo),
          createdAt: toDate(item.createdAt),
          updatedAt: toDate(item.updatedAt),
        })),
      });
    }

    if (tables.billingPeriod?.length) {
      await tx.billingPeriod.createMany({
        data: tables.billingPeriod.map((item) => ({
          ...item,
          ngayBatDau: toDate(item.ngayBatDau),
          ngayKetThuc: toDate(item.ngayKetThuc),
          createdAt: toDate(item.createdAt),
          updatedAt: toDate(item.updatedAt),
        })),
      });
    }

    if (tables.billingPeriodConfig?.length) {
      await tx.billingPeriodConfig.createMany({
        data: tables.billingPeriodConfig.map((item) => ({
          ...item,
          createdAt: toDate(item.createdAt),
          updatedAt: toDate(item.updatedAt),
        })),
      });
    }

    if (tables.menu?.length) {
      const roots = tables.menu.filter((item) => item.parentId === null);
      const children = tables.menu.filter((item) => item.parentId !== null);

      if (roots.length) {
        await tx.menu.createMany({ data: roots });
      }
      if (children.length) {
        await tx.menu.createMany({ data: children });
      }
    }

    if (tables.roleMenuPermission?.length) {
      await tx.roleMenuPermission.createMany({ data: tables.roleMenuPermission });
    }

    if (tables.collection?.length) {
      await tx.collection.createMany({
        data: tables.collection.map((item) => ({
          ...item,
          ngayThuGom: toDate(item.ngayThuGom),
          createdAt: toDate(item.createdAt),
          updatedAt: toDate(item.updatedAt),
        })),
      });
    }

    if (tables.invoice?.length) {
      await tx.invoice.createMany({
        data: tables.invoice.map((item) => ({
          ...item,
          tongTien: toDecimal(item.tongTien),
          thue: toDecimal(item.thue),
          hanThanhToan: toDate(item.hanThanhToan),
          paymentDate: toDate(item.paymentDate),
          invoiceIssuedAt: toDate(item.invoiceIssuedAt),
          createdAt: toDate(item.createdAt),
          updatedAt: toDate(item.updatedAt),
        })),
      });
    }

    if (tables.systemParameter?.length) {
      await tx.systemParameter.createMany({
        data: tables.systemParameter.map((item) => ({
          ...item,
          createdAt: toDate(item.createdAt),
          updatedAt: toDate(item.updatedAt),
        })),
      });
    }
  });

  await resetSequences();

  console.log(`DB import completed from: ${inputPath}`);
}

main()
  .catch((error) => {
    console.error('DB import failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
