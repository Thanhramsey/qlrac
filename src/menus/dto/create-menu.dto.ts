export class CreateMenuDto {
  menuKey!: string;
  tenMenu!: string;
  routePath?: string;
  parentId?: number | null;
  sortOrder?: number;
  viewMobile?: boolean;
  isActive?: boolean;
}
