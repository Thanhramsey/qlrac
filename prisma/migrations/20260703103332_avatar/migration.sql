-- DropForeignKey
ALTER TABLE "role_menu_permissions" DROP CONSTRAINT IF EXISTS "role_menu_permissions_menu_id_fkey";

-- AddForeignKey
ALTER TABLE "role_menu_permissions" ADD CONSTRAINT "role_menu_permissions_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
