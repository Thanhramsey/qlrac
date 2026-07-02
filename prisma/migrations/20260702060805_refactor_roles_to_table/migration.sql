/*
  Warnings:

  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "users_role_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "role_code" TEXT NOT NULL DEFAULT 'STAFF';

-- DropEnum
DROP TYPE "user_role";

-- CreateTable
CREATE TABLE "roles" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mo_ta" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("code")
);

-- Seed default roles before creating the users foreign key
INSERT INTO "roles" ("code", "label", "mo_ta", "is_active", "created_at", "updated_at")
VALUES
  ('ADMIN', 'Admin', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ADMIN_LEVEL_2', 'Admin mức 2', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ACCOUNTANT', 'Kế toán', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('STAFF', 'Nhân viên', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Keep old role values when converting enum -> relation
UPDATE "users"
SET "role_code" = CASE
  WHEN "role_code" = 'ADMIN' THEN 'ADMIN'
  WHEN "role_code" = 'ADMIN_LEVEL_2' THEN 'ADMIN_LEVEL_2'
  WHEN "role_code" = 'ACCOUNTANT' THEN 'ACCOUNTANT'
  ELSE 'STAFF'
END;

-- CreateIndex
CREATE INDEX "users_role_code_idx" ON "users"("role_code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "roles"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
