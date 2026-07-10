export const APP_ROLES = {
  ADMIN: 'ADMIN',
  ADMIN_LEVEL_2: 'ADMIN_LEVEL_2',
  ACCOUNTANT: 'ACCOUNTANT',
  STAFF: 'STAFF',
} as const;

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];
