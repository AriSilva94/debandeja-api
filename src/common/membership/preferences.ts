import type { Prisma } from '../../../generated/prisma/client';

export const DENSITIES = ['comfortable', 'compact'] as const;
export const PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_SCREENS = ['dashboard', 'products', 'stock'] as const;

export type Preferences = {
  defaultBranchId: string | null;
  lowStockEmailAlert: boolean;
  confirmBeforeExit: boolean;
  density: (typeof DENSITIES)[number];
  pageSize: (typeof PAGE_SIZES)[number];
  defaultScreen: (typeof DEFAULT_SCREENS)[number];
};

export type NotificationSettings = {
  dailySummary: boolean;
  inviteAlerts: boolean;
  productNews: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  defaultBranchId: null,
  lowStockEmailAlert: true,
  confirmBeforeExit: false,
  density: 'comfortable',
  pageSize: 20,
  defaultScreen: 'dashboard',
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dailySummary: true,
  inviteAlerts: true,
  productNews: false,
};

export function withDefaults<T extends object>(
  defaults: T,
  stored: Prisma.JsonValue | undefined,
): T {
  const values =
    stored && typeof stored === 'object' && !Array.isArray(stored)
      ? stored
      : {};
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    if (key in values) result[key] = values[key] as T[typeof key];
  }
  return result;
}
