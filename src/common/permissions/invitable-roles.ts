import { Role } from '../../../generated/prisma/enums';

export const INVITABLE_ROLES = [
  Role.ADMIN,
  Role.MANAGER,
  Role.SALES,
  Role.STOCKIST,
] as const;
