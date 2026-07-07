export class UpdateMenuDto {
  menuKey?: string;
  tenMenu?: string;
  routePath?: string | null;
  parentId?: number | null;
  sortOrder?: number;
  viewMobile?: boolean;
  isActive?: boolean;
}
