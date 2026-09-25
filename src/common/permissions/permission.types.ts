export enum PermissionModule {
  BRANCHES = 'branches',
  PRODUCTS = 'products',
  STOCK = 'stock',
  MOVEMENTS = 'movements',
  TEAM = 'team',
  BILLING = 'billing',
  COMPANY = 'company',
}

export enum PermissionLevel {
  NONE = 0,
  READ = 1,
  WRITE = 2,
  FULL = 3,
}
