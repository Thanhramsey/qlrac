import { SetMetadata } from '@nestjs/common';
import { AppPermission } from '../constants/app-permissions.constant';

export const PERMISSIONS_KEY = 'permissions';

export const RequirePermissions = (...permissions: AppPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
