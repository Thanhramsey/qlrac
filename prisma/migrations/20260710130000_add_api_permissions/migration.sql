CREATE TABLE IF NOT EXISTS "permissions" (
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "module_key" TEXT NOT NULL,
  "mo_ta" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("code")
);

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "role_code" TEXT NOT NULL,
  "permission_code" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_code", "permission_code")
);

CREATE INDEX IF NOT EXISTS "permissions_module_key_idx" ON "permissions"("module_key");
CREATE INDEX IF NOT EXISTS "permissions_is_active_idx" ON "permissions"("is_active");
CREATE INDEX IF NOT EXISTS "role_permissions_permission_code_idx" ON "role_permissions"("permission_code");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'role_permissions_role_code_fkey'
      AND table_name = 'role_permissions'
  ) THEN
    ALTER TABLE "role_permissions"
      ADD CONSTRAINT "role_permissions_role_code_fkey"
      FOREIGN KEY ("role_code") REFERENCES "roles"("code")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'role_permissions_permission_code_fkey'
      AND table_name = 'role_permissions'
  ) THEN
    ALTER TABLE "role_permissions"
      ADD CONSTRAINT "role_permissions_permission_code_fkey"
      FOREIGN KEY ("permission_code") REFERENCES "permissions"("code")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "permissions" ("code", "label", "module_key", "mo_ta") VALUES
  ('dashboard.read', 'Xem dashboard', 'dashboard', 'Xem số liệu tổng quan dashboard'),
  ('collections.read', 'Xem thu gom', 'collections', 'Xem danh sách thu gom'),
  ('collections.manage', 'Quản lý thu gom', 'collections', 'Tạo, sửa, xóa bản ghi thu gom'),
  ('collections.restore', 'Khôi phục thu gom', 'collections', 'Khôi phục bản ghi thu gom đã xóa mềm'),
  ('households.read', 'Xem hộ dân', 'households', 'Xem danh sách hộ dân'),
  ('households.manage', 'Quản lý hộ dân', 'households', 'Tạo, sửa, xóa hộ dân'),
  ('households.import', 'Import hộ dân', 'households', 'Nhập dữ liệu hộ dân từ file'),
  ('households.restore', 'Khôi phục hộ dân', 'households', 'Khôi phục hộ dân đã xóa mềm'),
  ('routes.read', 'Xem tuyến thu', 'routes', 'Xem danh sách tuyến thu'),
  ('routes.manage', 'Quản lý tuyến thu', 'routes', 'Tạo, sửa, xóa tuyến thu'),
  ('routes.import', 'Import tuyến thu', 'routes', 'Nhập dữ liệu tuyến thu từ file'),
  ('routes.restore', 'Khôi phục tuyến thu', 'routes', 'Khôi phục tuyến thu đã xóa mềm'),
  ('invoices.read', 'Xem hóa đơn', 'invoices', 'Xem danh sách và chi tiết hóa đơn'),
  ('invoices.report', 'Xem báo cáo hóa đơn', 'invoices', 'Xem báo cáo chi tiết và tổng hợp doanh thu'),
  ('invoices.manage', 'Quản lý hóa đơn', 'invoices', 'Tạo, sửa, đồng bộ metadata hóa đơn'),
  ('invoices.publish', 'Phát hành hóa đơn', 'invoices', 'Phát hành và tải hóa đơn điện tử'),
  ('invoices.collect', 'Thu tiền hóa đơn', 'invoices', 'Thao tác thu tiền và cập nhật trạng thái thanh toán'),
  ('invoices.delete', 'Xóa mềm hóa đơn', 'invoices', 'Xóa mềm hóa đơn'),
  ('invoices.restore', 'Khôi phục hóa đơn', 'invoices', 'Khôi phục hóa đơn đã xóa mềm'),
  ('billing_periods.read', 'Xem kỳ hóa đơn', 'billing-periods', 'Xem danh sách kỳ hóa đơn và cấu hình'),
  ('billing_periods.manage', 'Quản lý kỳ hóa đơn', 'billing-periods', 'Tạo, sửa và chạy sinh kỳ thủ công'),
  ('billing_periods.config', 'Cấu hình kỳ hóa đơn', 'billing-periods', 'Cập nhật cấu hình kỳ hóa đơn'),
  ('billing_periods.delete', 'Xóa mềm kỳ hóa đơn', 'billing-periods', 'Xóa mềm kỳ hóa đơn'),
  ('billing_periods.restore', 'Khôi phục kỳ hóa đơn', 'billing-periods', 'Khôi phục kỳ hóa đơn đã xóa mềm'),
  ('service_catalogs.read', 'Xem danh mục dịch vụ', 'service-catalogs', 'Xem danh sách dịch vụ'),
  ('service_catalogs.manage', 'Quản lý danh mục dịch vụ', 'service-catalogs', 'Tạo và sửa danh mục dịch vụ'),
  ('service_catalogs.delete', 'Xóa mềm danh mục dịch vụ', 'service-catalogs', 'Xóa mềm danh mục dịch vụ'),
  ('service_catalogs.restore', 'Khôi phục danh mục dịch vụ', 'service-catalogs', 'Khôi phục danh mục dịch vụ đã xóa mềm'),
  ('locations.read', 'Xem địa bàn', 'locations', 'Xem tỉnh, phường xã, thôn xóm tổ'),
  ('locations.manage', 'Quản lý địa bàn', 'locations', 'Tạo và sửa dữ liệu địa bàn'),
  ('locations.delete', 'Xóa mềm địa bàn', 'locations', 'Xóa mềm dữ liệu địa bàn'),
  ('locations.restore', 'Khôi phục địa bàn', 'locations', 'Khôi phục dữ liệu địa bàn đã xóa mềm'),
  ('system_parameters.read', 'Xem tham số hệ thống', 'system-parameters', 'Xem danh sách tham số hệ thống'),
  ('system_parameters.manage', 'Quản lý tham số hệ thống', 'system-parameters', 'Tạo và sửa tham số hệ thống'),
  ('system_parameters.delete', 'Xóa mềm tham số hệ thống', 'system-parameters', 'Xóa mềm tham số hệ thống'),
  ('system_parameters.restore', 'Khôi phục tham số hệ thống', 'system-parameters', 'Khôi phục tham số đã xóa mềm'),
  ('user_action_logs.read', 'Xem nhật ký thao tác', 'user-action-logs', 'Xem lịch sử thao tác người dùng'),
  ('roles.read', 'Xem danh sách quyền', 'roles', 'Xem role và thông tin role'),
  ('roles.manage', 'Quản lý quyền', 'roles', 'Tạo, sửa, xóa, khôi phục role'),
  ('roles.permissions.manage', 'Gán quyền API cho role', 'roles', 'Gán và cập nhật permission cho từng role'),
  ('users.read', 'Xem người dùng', 'users', 'Xem danh sách và chi tiết người dùng'),
  ('users.manage', 'Quản lý người dùng', 'users', 'Tạo, sửa, xóa mềm người dùng'),
  ('users.import', 'Import người dùng', 'users', 'Nhập danh sách người dùng từ file'),
  ('users.restore', 'Khôi phục người dùng', 'users', 'Khôi phục người dùng đã xóa mềm'),
  ('menus.read', 'Xem menu', 'menus', 'Xem danh sách cấu trúc menu'),
  ('menus.manage', 'Quản lý menu', 'menus', 'Tạo, sửa, xóa mềm menu'),
  ('menus.assign', 'Gán menu theo role', 'menus', 'Xem và cập nhật menu theo role')
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "module_key" = EXCLUDED."module_key",
  "mo_ta" = EXCLUDED."mo_ta",
  "updated_at" = CURRENT_TIMESTAMP;

WITH admin_permissions AS (
  SELECT "code" FROM "permissions" WHERE "is_active" = true
)
INSERT INTO "role_permissions" ("role_code", "permission_code")
SELECT 'ADMIN', p."code"
FROM admin_permissions p
ON CONFLICT ("role_code", "permission_code") DO NOTHING;

WITH manager_permissions AS (
  SELECT "code" FROM "permissions"
  WHERE "code" IN (
    'dashboard.read',
    'collections.read', 'collections.manage', 'collections.restore',
    'households.read', 'households.manage', 'households.import', 'households.restore',
    'routes.read', 'routes.manage', 'routes.import', 'routes.restore',
    'invoices.read', 'invoices.report', 'invoices.manage', 'invoices.publish', 'invoices.collect', 'invoices.delete', 'invoices.restore',
    'billing_periods.read', 'billing_periods.manage',
    'service_catalogs.read',
    'locations.read',
    'system_parameters.read',
    'user_action_logs.read',
    'roles.read',
    'users.read', 'users.import',
    'menus.read', 'menus.assign'
  )
)
INSERT INTO "role_permissions" ("role_code", "permission_code")
SELECT 'ADMIN_LEVEL_2', p."code"
FROM manager_permissions p
ON CONFLICT ("role_code", "permission_code") DO NOTHING;

WITH accountant_permissions AS (
  SELECT "code" FROM "permissions"
  WHERE "code" IN (
    'dashboard.read',
    'billing_periods.read',
    'service_catalogs.read',
    'invoices.read', 'invoices.report', 'invoices.manage', 'invoices.publish', 'invoices.collect',
    'users.read'
  )
)
INSERT INTO "role_permissions" ("role_code", "permission_code")
SELECT 'ACCOUNTANT', p."code"
FROM accountant_permissions p
ON CONFLICT ("role_code", "permission_code") DO NOTHING;

WITH staff_permissions AS (
  SELECT "code" FROM "permissions"
  WHERE "code" IN (
    'dashboard.read',
    'collections.read', 'collections.manage', 'collections.restore',
    'households.read', 'households.manage',
    'routes.read', 'routes.manage',
    'service_catalogs.read',
    'billing_periods.read',
    'invoices.read', 'invoices.report', 'invoices.publish', 'invoices.collect',
    'users.read'
  )
)
INSERT INTO "role_permissions" ("role_code", "permission_code")
SELECT 'STAFF', p."code"
FROM staff_permissions p
ON CONFLICT ("role_code", "permission_code") DO NOTHING;

WITH admin_manage_permissions AS (
  SELECT "code" FROM "permissions"
  WHERE "code" IN (
    'roles.manage', 'roles.permissions.manage',
    'users.manage', 'users.restore',
    'menus.manage'
  )
)
INSERT INTO "role_permissions" ("role_code", "permission_code")
SELECT 'ADMIN', p."code"
FROM admin_manage_permissions p
ON CONFLICT ("role_code", "permission_code") DO NOTHING;
