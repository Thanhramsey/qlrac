export class CreateMenuDto {
  menuKey!: string;
  tenMenu!: string;
  routePath?: string;
  parentId?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}
