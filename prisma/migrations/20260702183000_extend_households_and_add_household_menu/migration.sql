-- AlterTable
ALTER TABLE "households"
  ADD COLUMN "so_giay_to" TEXT,
  ADD COLUMN "ngay_cap_giay_to" TIMESTAMP(3),
  ADD COLUMN "ma_so_thue" TEXT,
  ADD COLUMN "service_catalog_id" INTEGER,
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- Fill temporary value for existing rows to satisfy NOT NULL + UNIQUE
UPDATE "households"
SET "so_giay_to" = CONCAT('AUTO-', "id")
WHERE "so_giay_to" IS NULL;

ALTER TABLE "households"
  ALTER COLUMN "so_giay_to" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "households_so_giay_to_key" ON "households"("so_giay_to");

-- CreateIndex
CREATE INDEX "households_service_catalog_id_idx" ON "households"("service_catalog_id");

-- CreateIndex
CREATE INDEX "households_is_active_idx" ON "households"("is_active");

-- AddForeignKey
ALTER TABLE "households" ADD CONSTRAINT "households_service_catalog_id_fkey"
FOREIGN KEY ("service_catalog_id") REFERENCES "service_catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed household management menu under user-management
INSERT INTO "menus" ("menu_key", "ten_menu", "route_path", "parent_id", "sort_order", "is_active", "created_at", "updated_at")
SELECT 'households', 'Quản lý hộ dân', '/households', parent."id", 15, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "menus" parent
WHERE parent."menu_key" = 'user-management'
  AND NOT EXISTS (
    SELECT 1 FROM "menus" m WHERE m."menu_key" = 'households'
  );

-- Ensure ADMIN has menu households
INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'ADMIN', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" = 'households'
  AND NOT EXISTS (
    SELECT 1
    FROM "role_menu_permissions" p
    WHERE p."role_code" = 'ADMIN' AND p."menu_id" = m."id"
  );

-- Ensure ADMIN_LEVEL_2 has menu households
INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'ADMIN_LEVEL_2', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" = 'households'
  AND NOT EXISTS (
    SELECT 1
    FROM "role_menu_permissions" p
    WHERE p."role_code" = 'ADMIN_LEVEL_2' AND p."menu_id" = m."id"
  );

-- Ensure STAFF has menu households
INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'STAFF', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" = 'households'
  AND NOT EXISTS (
    SELECT 1
    FROM "role_menu_permissions" p
    WHERE p."role_code" = 'STAFF' AND p."menu_id" = m."id"
  );
