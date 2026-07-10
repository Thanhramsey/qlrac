export const APP_PERMISSIONS = {
  DASHBOARD_READ: 'dashboard.read',

  COLLECTIONS_READ: 'collections.read',
  COLLECTIONS_MANAGE: 'collections.manage',
  COLLECTIONS_RESTORE: 'collections.restore',

  HOUSEHOLDS_READ: 'households.read',
  HOUSEHOLDS_MANAGE: 'households.manage',
  HOUSEHOLDS_IMPORT: 'households.import',
  HOUSEHOLDS_RESTORE: 'households.restore',

  ROUTES_READ: 'routes.read',
  ROUTES_MANAGE: 'routes.manage',
  ROUTES_IMPORT: 'routes.import',
  ROUTES_RESTORE: 'routes.restore',

  INVOICES_READ: 'invoices.read',
  INVOICES_REPORT: 'invoices.report',
  INVOICES_MANAGE: 'invoices.manage',
  INVOICES_PUBLISH: 'invoices.publish',
  INVOICES_COLLECT: 'invoices.collect',
  INVOICES_DELETE: 'invoices.delete',
  INVOICES_RESTORE: 'invoices.restore',

  BILLING_PERIODS_READ: 'billing_periods.read',
  BILLING_PERIODS_MANAGE: 'billing_periods.manage',
  BILLING_PERIODS_CONFIG: 'billing_periods.config',
  BILLING_PERIODS_DELETE: 'billing_periods.delete',
  BILLING_PERIODS_RESTORE: 'billing_periods.restore',

  SERVICE_CATALOGS_READ: 'service_catalogs.read',
  SERVICE_CATALOGS_MANAGE: 'service_catalogs.manage',
  SERVICE_CATALOGS_DELETE: 'service_catalogs.delete',
  SERVICE_CATALOGS_RESTORE: 'service_catalogs.restore',

  LOCATIONS_READ: 'locations.read',
  LOCATIONS_MANAGE: 'locations.manage',
  LOCATIONS_DELETE: 'locations.delete',
  LOCATIONS_RESTORE: 'locations.restore',

  SYSTEM_PARAMETERS_READ: 'system_parameters.read',
  SYSTEM_PARAMETERS_MANAGE: 'system_parameters.manage',
  SYSTEM_PARAMETERS_DELETE: 'system_parameters.delete',
  SYSTEM_PARAMETERS_RESTORE: 'system_parameters.restore',

  USER_ACTION_LOGS_READ: 'user_action_logs.read',

  ROLES_READ: 'roles.read',
  ROLES_MANAGE: 'roles.manage',
  ROLES_PERMISSION_MANAGE: 'roles.permissions.manage',
  ROLES_PERMISSION_MANAGE_DANGEROUS: 'roles.permissions.manage.dangerous',

  USERS_READ: 'users.read',
  USERS_MANAGE: 'users.manage',
  USERS_IMPORT: 'users.import',
  USERS_RESTORE: 'users.restore',

  MENUS_READ: 'menus.read',
  MENUS_MANAGE: 'menus.manage',
  MENUS_ASSIGN: 'menus.assign',
} as const;

export type AppPermission =
  (typeof APP_PERMISSIONS)[keyof typeof APP_PERMISSIONS];
