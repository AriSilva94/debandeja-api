import { Role } from '../../../generated/prisma/enums';
import { PermissionLevel, PermissionModule } from './permission.types';

const { NONE, READ, WRITE, FULL } = PermissionLevel;

export const PERMISSION_MATRIX: Record<
  Role,
  Record<PermissionModule, PermissionLevel>
> = {
  [Role.OWNER]: {
    [PermissionModule.BRANCHES]: FULL,
    [PermissionModule.PRODUCTS]: FULL,
    [PermissionModule.STOCK]: FULL,
    [PermissionModule.MOVEMENTS]: FULL,
    [PermissionModule.TEAM]: FULL,
    [PermissionModule.BILLING]: FULL,
    [PermissionModule.COMPANY]: FULL,
  },
  [Role.ADMIN]: {
    [PermissionModule.BRANCHES]: FULL,
    [PermissionModule.PRODUCTS]: FULL,
    [PermissionModule.STOCK]: FULL,
    [PermissionModule.MOVEMENTS]: FULL,
    [PermissionModule.TEAM]: FULL,
    [PermissionModule.BILLING]: WRITE,
    [PermissionModule.COMPANY]: WRITE,
  },
  [Role.MANAGER]: {
    [PermissionModule.BRANCHES]: READ,
    [PermissionModule.PRODUCTS]: WRITE,
    [PermissionModule.STOCK]: WRITE,
    [PermissionModule.MOVEMENTS]: WRITE,
    [PermissionModule.TEAM]: READ,
    [PermissionModule.BILLING]: NONE,
    [PermissionModule.COMPANY]: READ,
  },
  [Role.SALES]: {
    [PermissionModule.BRANCHES]: NONE,
    [PermissionModule.PRODUCTS]: READ,
    [PermissionModule.STOCK]: READ,
    [PermissionModule.MOVEMENTS]: WRITE,
    [PermissionModule.TEAM]: NONE,
    [PermissionModule.BILLING]: NONE,
    [PermissionModule.COMPANY]: READ,
  },
  [Role.STOCKIST]: {
    [PermissionModule.BRANCHES]: NONE,
    [PermissionModule.PRODUCTS]: READ,
    [PermissionModule.STOCK]: WRITE,
    [PermissionModule.MOVEMENTS]: WRITE,
    [PermissionModule.TEAM]: NONE,
    [PermissionModule.BILLING]: NONE,
    [PermissionModule.COMPANY]: READ,
  },
};
