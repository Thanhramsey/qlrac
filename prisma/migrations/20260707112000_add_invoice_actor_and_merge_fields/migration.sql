ALTER TABLE "invoices"
ADD COLUMN "published_by_id" INTEGER,
ADD COLUMN "published_by_name" TEXT,
ADD COLUMN "collected_by_id" INTEGER,
ADD COLUMN "collected_by_name" TEXT,
ADD COLUMN "merged_period_codes" TEXT;

CREATE INDEX "invoices_published_by_id_idx" ON "invoices"("published_by_id");
CREATE INDEX "invoices_collected_by_id_idx" ON "invoices"("collected_by_id");
