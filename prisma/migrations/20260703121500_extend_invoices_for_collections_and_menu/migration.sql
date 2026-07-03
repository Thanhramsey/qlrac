-- AlterTable
ALTER TABLE "invoices"
  ADD COLUMN "payment_date" TIMESTAMP(3),
  ADD COLUMN "payment_note" TEXT,
  ADD COLUMN "receipt_image_url" TEXT;

-- Parent menu: invoice-management
INSERT INTO "menus" ("menu_key", "ten_menu", "route_path", "parent_id", "sort_order", "is_active", "created_at", "updated_at")
SELECT 'invoice-management', 'Quản lý hóa đơn', NULL, NULL, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "menus" m WHERE m."menu_key" = 'invoice-management'
);

-- Child menu: invoice-collections
INSERT INTO "menus" ("menu_key", "ten_menu", "route_path", "parent_id", "sort_order", "is_active", "created_at", "updated_at")
SELECT 'invoice-collections', 'Quản lý thu tiền', '/invoice-collections', parent."id", 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "menus" parent
WHERE parent."menu_key" = 'invoice-management'
  AND NOT EXISTS (
    SELECT 1 FROM "menus" m WHERE m."menu_key" = 'invoice-collections'
  );

-- Grant role permissions
INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'ADMIN', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" = 'invoice-management'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menu_permissions" p
    WHERE p."role_code" = 'ADMIN' AND p."menu_id" = m."id"
  );

INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'ADMIN_LEVEL_2', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" = 'invoice-management'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menu_permissions" p
    WHERE p."role_code" = 'ADMIN_LEVEL_2' AND p."menu_id" = m."id"
  );

INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'ACCOUNTANT', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" = 'invoice-management'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menu_permissions" p
    WHERE p."role_code" = 'ACCOUNTANT' AND p."menu_id" = m."id"
  );

INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'STAFF', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" = 'invoice-management'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menu_permissions" p
    WHERE p."role_code" = 'STAFF' AND p."menu_id" = m."id"
  );

INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'ADMIN', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" = 'invoice-collections'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menu_permissions" p
    WHERE p."role_code" = 'ADMIN' AND p."menu_id" = m."id"
  );

INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'ADMIN_LEVEL_2', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" = 'invoice-collections'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menu_permissions" p
    WHERE p."role_code" = 'ADMIN_LEVEL_2' AND p."menu_id" = m."id"
  );

INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'ACCOUNTANT', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" = 'invoice-collections'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menu_permissions" p
    WHERE p."role_code" = 'ACCOUNTANT' AND p."menu_id" = m."id"
  );

INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'STAFF', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" = 'invoice-collections'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menu_permissions" p
    WHERE p."role_code" = 'STAFF' AND p."menu_id" = m."id"
  );
