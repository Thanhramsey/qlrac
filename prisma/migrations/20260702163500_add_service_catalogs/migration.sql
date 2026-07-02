-- CreateTable
CREATE TABLE "service_catalogs" (
    "id" SERIAL NOT NULL,
    "ma_dich_vu" TEXT NOT NULL,
    "ten_dich_vu" TEXT NOT NULL,
    "gia_dich_vu" DECIMAL(18,2) NOT NULL,
    "thue_phan_tram" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "ghi_chu" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_catalogs_ma_dich_vu_key" ON "service_catalogs"("ma_dich_vu");

-- CreateIndex
CREATE INDEX "service_catalogs_is_active_idx" ON "service_catalogs"("is_active");
