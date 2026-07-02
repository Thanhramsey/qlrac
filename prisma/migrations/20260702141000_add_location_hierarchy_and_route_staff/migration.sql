-- CreateTable
CREATE TABLE "provinces" (
    "id" SERIAL NOT NULL,
    "ma_tinh" TEXT NOT NULL,
    "ten_tinh" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wards" (
    "id" SERIAL NOT NULL,
    "province_id" INTEGER NOT NULL,
    "ma_phuong_xa" TEXT NOT NULL,
    "ten_phuong_xa" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "localities" (
    "id" SERIAL NOT NULL,
    "ward_id" INTEGER NOT NULL,
    "ma_thon_xom_to" TEXT NOT NULL,
    "ten_thon_xom_to" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "localities_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "routes"
ADD COLUMN "locality_id" INTEGER,
ADD COLUMN "staff_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "provinces_ma_tinh_key" ON "provinces"("ma_tinh");

-- CreateIndex
CREATE UNIQUE INDEX "wards_province_id_ma_phuong_xa_key" ON "wards"("province_id", "ma_phuong_xa");

-- CreateIndex
CREATE INDEX "wards_province_id_idx" ON "wards"("province_id");

-- CreateIndex
CREATE UNIQUE INDEX "localities_ward_id_ma_thon_xom_to_key" ON "localities"("ward_id", "ma_thon_xom_to");

-- CreateIndex
CREATE INDEX "localities_ward_id_idx" ON "localities"("ward_id");

-- CreateIndex
CREATE INDEX "routes_locality_id_idx" ON "routes"("locality_id");

-- CreateIndex
CREATE INDEX "routes_staff_id_idx" ON "routes"("staff_id");

-- AddForeignKey
ALTER TABLE "wards"
ADD CONSTRAINT "wards_province_id_fkey"
FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "localities"
ADD CONSTRAINT "localities_ward_id_fkey"
FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes"
ADD CONSTRAINT "routes_locality_id_fkey"
FOREIGN KEY ("locality_id") REFERENCES "localities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes"
ADD CONSTRAINT "routes_staff_id_fkey"
FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
