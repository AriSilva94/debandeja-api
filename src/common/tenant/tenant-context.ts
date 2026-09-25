import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { Role } from '../../../generated/prisma/enums';

export type TenantContext = {
  tenantId: string;
  userId: string;
  membershipId: string;
  role: Role;
  allowedBranchIds: string[] | null;
  readOnly: boolean;
};

export const CurrentTenant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest<{ tenant: TenantContext }>();
    return request.tenant;
  },
);
