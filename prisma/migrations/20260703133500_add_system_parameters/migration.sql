-- CreateTable
CREATE TABLE "system_parameters" (
    "id" SERIAL NOT NULL,
    "ten_tham_so" TEXT NOT NULL,
    "gia_tri" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_parameters_ten_tham_so_key" ON "system_parameters"("ten_tham_so");

-- CreateIndex
CREATE INDEX "system_parameters_ten_tham_so_idx" ON "system_parameters"("ten_tham_so");

-- Seed menu under user-management
INSERT INTO "menus" ("menu_key", "ten_menu", "route_path", "parent_id", "sort_order", "is_active", "created_at", "updated_at")
SELECT 'system-parameters', 'Tham số hệ thống', '/system-parameters', parent."id", 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "menus" parent
WHERE parent."menu_key" = 'user-management'
  AND NOT EXISTS (
    SELECT 1 FROM "menus" m WHERE m."menu_key" = 'system-parameters'
  );

-- Grant role permissions
INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'ADMIN', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" = 'system-parameters'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menu_permissions" p
    WHERE p."role_code" = 'ADMIN' AND p."menu_id" = m."id"
  );

INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'ADMIN_LEVEL_2', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" = 'system-parameters'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menu_permissions" p
    WHERE p."role_code" = 'ADMIN_LEVEL_2' AND p."menu_id" = m."id"
  );

-- Seed default system parameters
INSERT INTO "system_parameters" ("ten_tham_so", "gia_tri", "created_at", "updated_at")
VALUES
  ('Tên đơn vị', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Mã số thuế', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Số điện thoại', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Địa chỉ', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Số tài khoản ngân hàng', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Người đại diện', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Mẫu số hóa đơn', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Ký hiệu hóa đơn', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('PUBLISH_SERVICE_ADDRESS_ID', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('BUSINESS_SERVICE_ADDRESS_ID', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('PORTAL_SERVICE_ADDRESS_ID', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('C_PASSWORD_ID', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('C_USER_ID', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('WS_PASSWORD_ID', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('WS_USER_ID', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("ten_tham_so") DO NOTHING;
