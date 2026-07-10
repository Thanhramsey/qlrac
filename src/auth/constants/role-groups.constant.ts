import { APP_ROLES } from './app-roles.constant';

export const ROLE_GROUPS = {
  adminOnly: [APP_ROLES.ADMIN],
  adminManagers: [APP_ROLES.ADMIN, APP_ROLES.ADMIN_LEVEL_2],
  billingOperators: [
    APP_ROLES.ADMIN,
    APP_ROLES.ADMIN_LEVEL_2,
    APP_ROLES.ACCOUNTANT,
    APP_ROLES.STAFF,
  ],
  routeOperators: [APP_ROLES.ADMIN, APP_ROLES.ADMIN_LEVEL_2, APP_ROLES.STAFF],
} as const;
