-- CreateTable
CREATE TABLE "billing_periods" (
    "id" SERIAL NOT NULL,
    "ma_ky" TEXT NOT NULL,
    "ten_ky" TEXT NOT NULL,
    "ngay_bat_dau" TIMESTAMP(3) NOT NULL,
    "ngay_ket_thuc" TIMESTAMP(3) NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "is_auto_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_period_configs" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "auto_create_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_period_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_periods_ma_ky_key" ON "billing_periods"("ma_ky");

-- CreateIndex
CREATE INDEX "billing_periods_ngay_bat_dau_ngay_ket_thuc_idx" ON "billing_periods"("ngay_bat_dau", "ngay_ket_thuc");

-- CreateIndex
CREATE INDEX "billing_periods_is_closed_idx" ON "billing_periods"("is_closed");

-- Seed billing period config
INSERT INTO "billing_period_configs" ("id", "auto_create_enabled", "created_at", "updated_at")
VALUES (1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE
SET "auto_create_enabled" = EXCLUDED."auto_create_enabled",
    "updated_at" = CURRENT_TIMESTAMP;

-- Seed menu under catalog-management
INSERT INTO "menus" ("menu_key", "ten_menu", "route_path", "parent_id", "sort_order", "is_active", "created_at", "updated_at")
SELECT 'billing-periods', 'Quản lý kỳ hóa đơn', '/billing-periods', parent."id", 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "menus" parent
WHERE parent."menu_key" = 'catalog-management'
  AND NOT EXISTS (
    SELECT 1 FROM "menus" m WHERE m."menu_key" = 'billing-periods'
  );

-- Grant role permissions
INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'ADMIN', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" = 'billing-periods'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menu_permissions" p WHERE p."role_code" = 'ADMIN' AND p."menu_id" = m."id"
  );

INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'ADMIN_LEVEL_2', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" = 'billing-periods'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menu_permissions" p WHERE p."role_code" = 'ADMIN_LEVEL_2' AND p."menu_id" = m."id"
  );

INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'ACCOUNTANT', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" = 'billing-periods'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menu_permissions" p WHERE p."role_code" = 'ACCOUNTANT' AND p."menu_id" = m."id"
  );
