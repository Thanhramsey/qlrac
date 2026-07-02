-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "maHoDan" TEXT NOT NULL,
    "tenChuHo" TEXT NOT NULL,
    "diaChi" TEXT NOT NULL,
    "soDienThoai" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_maHoDan_key" ON "Customer"("maHoDan");
