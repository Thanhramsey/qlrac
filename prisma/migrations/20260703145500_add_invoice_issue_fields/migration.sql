-- AlterTable
ALTER TABLE "invoices"
  ADD COLUMN "invoice_serial" TEXT,
  ADD COLUMN "invoice_fkey" TEXT,
  ADD COLUMN "invoice_issued_at" TIMESTAMP(3),
  ADD COLUMN "invoice_publish_status" TEXT,
  ADD COLUMN "invoice_publish_message" TEXT;

-- CreateIndex
CREATE INDEX "invoices_invoice_publish_status_idx" ON "invoices"("invoice_publish_status");

-- CreateIndex
CREATE INDEX "invoices_invoice_issued_at_idx" ON "invoices"("invoice_issued_at");
