CREATE TABLE IF NOT EXISTS "user_action_logs" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER,
  "tai_khoan" TEXT,
  "ho_va_ten" TEXT,
  "role_code" TEXT,
  "http_method" TEXT NOT NULL,
  "module_key" TEXT,
  "action" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "status_code" INTEGER NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "request_data" JSONB,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_action_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "user_action_logs_user_id_idx"
  ON "user_action_logs"("user_id");
CREATE INDEX IF NOT EXISTS "user_action_logs_module_key_idx"
  ON "user_action_logs"("module_key");
CREATE INDEX IF NOT EXISTS "user_action_logs_http_method_idx"
  ON "user_action_logs"("http_method");
CREATE INDEX IF NOT EXISTS "user_action_logs_status_code_idx"
  ON "user_action_logs"("status_code");
CREATE INDEX IF NOT EXISTS "user_action_logs_created_at_idx"
  ON "user_action_logs"("created_at");

WITH parent_menu AS (
  SELECT "id"
  FROM "menus"
  WHERE "menu_key" = 'user-management'
  LIMIT 1
), upsert_menu AS (
  INSERT INTO "menus" (
    "menu_key",
    "ten_menu",
    "route_path",
    "parent_id",
    "sort_order",
    "view_mobile",
    "is_active",
    "created_at",
    "updated_at"
  )
  SELECT
    'user-action-logs',
    'Nhật ký thao tác',
    '/user-action-logs',
    parent_menu."id",
    35,
    false,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM parent_menu
  ON CONFLICT ("menu_key") DO UPDATE
  SET
    "ten_menu" = EXCLUDED."ten_menu",
    "route_path" = EXCLUDED."route_path",
    "parent_id" = EXCLUDED."parent_id",
    "sort_order" = EXCLUDED."sort_order",
    "view_mobile" = EXCLUDED."view_mobile",
    "is_active" = EXCLUDED."is_active",
    "updated_at" = CURRENT_TIMESTAMP
  RETURNING "id"
)
INSERT INTO "role_menu_permissions" ("role_code", "menu_id")
SELECT role_code, menu_id
FROM (
  SELECT 'ADMIN'::TEXT AS role_code, "id" AS menu_id FROM upsert_menu
  UNION ALL
  SELECT 'ADMIN_LEVEL_2'::TEXT AS role_code, "id" AS menu_id FROM upsert_menu
) role_menu
ON CONFLICT ("role_code", "menu_id") DO NOTHING;
