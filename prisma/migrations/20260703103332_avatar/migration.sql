-- DropForeignKey
ALTER TABLE "role_menu_permissions" DROP CONSTRAINT "role_menu_permissions_menu_id_fkey";

-- DropIndex
DROP INDEX "invoices_invoice_issued_at_idx";

-- DropIndex
DROP INDEX "invoices_invoice_publish_status_idx";

-- AddForeignKey
ALTER TABLE "role_menu_permissions" ADD CONSTRAINT "role_menu_permissions_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
