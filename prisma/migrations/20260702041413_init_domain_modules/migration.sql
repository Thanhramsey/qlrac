/*
  Warnings:

  - You are about to drop the `Customer` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "collection_status" AS ENUM ('PENDING', 'COMPLETED', 'MISSED');

-- CreateEnum
CREATE TYPE "invoice_payment_status" AS ENUM ('UNPAID', 'PAID', 'OVERDUE');

-- DropTable
DROP TABLE "Customer";

-- CreateTable
CREATE TABLE "households" (
    "id" SERIAL NOT NULL,
    "ma_ho_dan" TEXT NOT NULL,
    "ten_chu_ho" TEXT NOT NULL,
    "dia_chi" TEXT NOT NULL,
    "so_dien_thoai" TEXT NOT NULL,
    "tuyen_thu_rac_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" SERIAL NOT NULL,
    "ma_tuyen" TEXT NOT NULL,
    "ten_tuyen" TEXT NOT NULL,
    "khu_vuc" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" SERIAL NOT NULL,
    "household_id" INTEGER NOT NULL,
    "route_id" INTEGER NOT NULL,
    "ngay_thu_gom" TIMESTAMP(3) NOT NULL,
    "trang_thai" "collection_status" NOT NULL DEFAULT 'PENDING',
    "ghi_chu" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "household_id" INTEGER NOT NULL,
    "ky_hoa_don" TEXT NOT NULL,
    "tong_tien" DECIMAL(18,2) NOT NULL,
    "thue" DECIMAL(18,2) NOT NULL,
    "trang_thai_thanh_toan" "invoice_payment_status" NOT NULL DEFAULT 'UNPAID',
    "han_thanh_toan" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "households_ma_ho_dan_key" ON "households"("ma_ho_dan");

-- CreateIndex
CREATE INDEX "households_tuyen_thu_rac_id_idx" ON "households"("tuyen_thu_rac_id");

-- CreateIndex
CREATE UNIQUE INDEX "routes_ma_tuyen_key" ON "routes"("ma_tuyen");

-- CreateIndex
CREATE INDEX "collections_household_id_idx" ON "collections"("household_id");

-- CreateIndex
CREATE INDEX "collections_route_id_idx" ON "collections"("route_id");

-- CreateIndex
CREATE INDEX "collections_ngay_thu_gom_trang_thai_idx" ON "collections"("ngay_thu_gom", "trang_thai");

-- CreateIndex
CREATE INDEX "invoices_household_id_idx" ON "invoices"("household_id");

-- CreateIndex
CREATE INDEX "invoices_ky_hoa_don_trang_thai_thanh_toan_idx" ON "invoices"("ky_hoa_don", "trang_thai_thanh_toan");

-- AddForeignKey
ALTER TABLE "households" ADD CONSTRAINT "households_tuyen_thu_rac_id_fkey" FOREIGN KEY ("tuyen_thu_rac_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
