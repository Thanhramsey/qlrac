import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
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

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function normalize(value) {
  return JSON.parse(
    JSON.stringify(value, (_, val) => {
      if (typeof val === 'bigint') {
        return val.toString();
      }
      return val;
    }),
  );
}

async function main() {
  const data = {
    exportedAt: new Date().toISOString(),
    schema: 'quanlythurac',
    tables: {},
  };

  data.tables.role = normalize(await prisma.role.findMany({ orderBy: { code: 'asc' } }));
  data.tables.province = normalize(await prisma.province.findMany({ orderBy: { id: 'asc' } }));
  data.tables.ward = normalize(await prisma.ward.findMany({ orderBy: { id: 'asc' } }));
  data.tables.locality = normalize(await prisma.locality.findMany({ orderBy: { id: 'asc' } }));
  data.tables.serviceCatalog = normalize(await prisma.serviceCatalog.findMany({ orderBy: { id: 'asc' } }));
  data.tables.user = normalize(await prisma.user.findMany({ orderBy: { id: 'asc' } }));
  data.tables.route = normalize(await prisma.route.findMany({ orderBy: { id: 'asc' } }));
  data.tables.household = normalize(await prisma.household.findMany({ orderBy: { id: 'asc' } }));
  data.tables.billingPeriod = normalize(await prisma.billingPeriod.findMany({ orderBy: { id: 'asc' } }));
  data.tables.billingPeriodConfig = normalize(await prisma.billingPeriodConfig.findMany({ orderBy: { id: 'asc' } }));
  data.tables.menu = normalize(await prisma.menu.findMany({ orderBy: { id: 'asc' } }));
  data.tables.roleMenuPermission = normalize(
    await prisma.roleMenuPermission.findMany({ orderBy: [{ roleCode: 'asc' }, { menuId: 'asc' }] }),
  );
  data.tables.collection = normalize(await prisma.collection.findMany({ orderBy: { id: 'asc' } }));
  data.tables.invoice = normalize(await prisma.invoice.findMany({ orderBy: { id: 'asc' } }));
  data.tables.systemParameter = normalize(await prisma.systemParameter.findMany({ orderBy: { id: 'asc' } }));

  const backupDir = path.resolve(process.cwd(), 'backups');
  await mkdir(backupDir, { recursive: true });

  const filePath = path.join(backupDir, `db-export-${timestamp()}.json`);
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

  console.log(`DB export completed: ${filePath}`);
}

main()
  .catch((error) => {
    console.error('DB export failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
