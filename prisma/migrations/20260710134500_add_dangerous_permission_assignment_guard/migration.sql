INSERT INTO "permissions" ("code", "label", "module_key", "mo_ta") VALUES
  (
    'roles.permissions.manage.dangerous',
    'Gán quyền API nhạy cảm',
    'roles',
    'Cho phép gán các permission có hậu tố .delete hoặc .restore cho role khác'
  )
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "module_key" = EXCLUDED."module_key",
  "mo_ta" = EXCLUDED."mo_ta",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("role_code", "permission_code")
VALUES ('ADMIN', 'roles.permissions.manage.dangerous')
ON CONFLICT ("role_code", "permission_code") DO NOTHING;
