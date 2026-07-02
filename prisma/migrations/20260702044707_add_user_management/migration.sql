-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'ADMIN_LEVEL_2', 'ACCOUNTANT', 'STAFF');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "tai_khoan" TEXT NOT NULL,
    "mat_khau_hash" TEXT NOT NULL,
    "ho_va_ten" TEXT NOT NULL,
    "ngay_sinh" TIMESTAMP(3),
    "gioi_tinh" TEXT,
    "so_dien_thoai" TEXT NOT NULL,
    "so_giay_to" TEXT NOT NULL,
    "dia_chi" TEXT,
    "email" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'STAFF',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_tai_khoan_key" ON "users"("tai_khoan");

-- CreateIndex
CREATE UNIQUE INDEX "users_so_giay_to_key" ON "users"("so_giay_to");

-- CreateIndex
CREATE INDEX "users_so_dien_thoai_idx" ON "users"("so_dien_thoai");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");
