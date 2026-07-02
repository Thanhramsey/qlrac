-- CreateTable
CREATE TABLE "menus" (
    "id" SERIAL NOT NULL,
    "menu_key" TEXT NOT NULL,
    "ten_menu" TEXT NOT NULL,
    "route_path" TEXT,
    "parent_id" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_menu_permissions" (
    "role_code" TEXT NOT NULL,
    "menu_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_menu_permissions_pkey" PRIMARY KEY ("role_code","menu_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "menus_menu_key_key" ON "menus"("menu_key");

-- CreateIndex
CREATE INDEX "menus_parent_id_idx" ON "menus"("parent_id");

-- CreateIndex
CREATE INDEX "menus_is_active_idx" ON "menus"("is_active");

-- CreateIndex
CREATE INDEX "menus_sort_order_idx" ON "menus"("sort_order");

-- CreateIndex
CREATE INDEX "role_menu_permissions_menu_id_idx" ON "role_menu_permissions"("menu_id");

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_menu_permissions" ADD CONSTRAINT "role_menu_permissions_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "roles"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_menu_permissions" ADD CONSTRAINT "role_menu_permissions_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed parent menus
INSERT INTO "menus" ("menu_key", "ten_menu", "route_path", "parent_id", "sort_order", "is_active", "created_at", "updated_at")
VALUES
  ('user-management', 'Quản trị hệ thống', NULL, NULL, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('catalog-management', 'Quản trị danh mục', NULL, NULL, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Seed child menus
INSERT INTO "menus" ("menu_key", "ten_menu", "route_path", "parent_id", "sort_order", "is_active", "created_at", "updated_at")
SELECT 'users', 'Danh sách người dùng', '/users', p."id", 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "menus" p WHERE p."menu_key" = 'user-management';

INSERT INTO "menus" ("menu_key", "ten_menu", "route_path", "parent_id", "sort_order", "is_active", "created_at", "updated_at")
SELECT 'roles', 'Quản lý quyền', '/roles', p."id", 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "menus" p WHERE p."menu_key" = 'user-management';

INSERT INTO "menus" ("menu_key", "ten_menu", "route_path", "parent_id", "sort_order", "is_active", "created_at", "updated_at")
SELECT 'user-permissions', 'Phân quyền người dùng', '/user-permissions', p."id", 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "menus" p WHERE p."menu_key" = 'user-management';

INSERT INTO "menus" ("menu_key", "ten_menu", "route_path", "parent_id", "sort_order", "is_active", "created_at", "updated_at")
SELECT 'locations', 'Quản lý địa danh', '/locations', p."id", 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "menus" p WHERE p."menu_key" = 'catalog-management';

INSERT INTO "menus" ("menu_key", "ten_menu", "route_path", "parent_id", "sort_order", "is_active", "created_at", "updated_at")
SELECT 'service-catalogs', 'Danh mục dịch vụ', '/service-catalogs', p."id", 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "menus" p WHERE p."menu_key" = 'catalog-management';

-- Seed role menu permissions (admin all active menus)
INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'ADMIN', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."is_active" = true;

-- Seed role menu permissions (ADMIN_LEVEL_2 all active menus except role/user permission management)
INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'ADMIN_LEVEL_2', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."is_active" = true
  AND m."menu_key" NOT IN ('roles', 'user-permissions');

-- Seed role menu permissions (STAFF only locations)
INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'STAFF', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" IN ('catalog-management', 'locations');

-- Seed role menu permissions (ACCOUNTANT service catalogs)
INSERT INTO "role_menu_permissions" ("role_code", "menu_id", "created_at")
SELECT 'ACCOUNTANT', m."id", CURRENT_TIMESTAMP
FROM "menus" m
WHERE m."menu_key" IN ('catalog-management', 'service-catalogs');
