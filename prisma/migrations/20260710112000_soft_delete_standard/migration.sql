ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "provinces" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "wards" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "localities" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "billing_periods" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "system_parameters" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "routes_is_active_idx" ON "routes"("is_active");
CREATE INDEX IF NOT EXISTS "provinces_is_active_idx" ON "provinces"("is_active");
CREATE INDEX IF NOT EXISTS "wards_is_active_idx" ON "wards"("is_active");
CREATE INDEX IF NOT EXISTS "localities_is_active_idx" ON "localities"("is_active");
CREATE INDEX IF NOT EXISTS "collections_is_active_idx" ON "collections"("is_active");
CREATE INDEX IF NOT EXISTS "invoices_is_active_idx" ON "invoices"("is_active");
CREATE INDEX IF NOT EXISTS "billing_periods_is_active_idx" ON "billing_periods"("is_active");
CREATE INDEX IF NOT EXISTS "system_parameters_is_active_idx" ON "system_parameters"("is_active");
