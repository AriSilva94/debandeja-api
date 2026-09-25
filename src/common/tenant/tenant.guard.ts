import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../../../generated/prisma/enums';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import type { TenantContext } from './tenant-context';
import {
  effectiveSubscriptionStatus,
  isReadOnlyStatus,
} from '../plan/subscription-status';

const TENANT_HEADER = 'x-tenant-id';
const FULL_ACCESS_ROLES: Role[] = [Role.OWNER, Role.ADMIN];
const LAST_ACCESS_WRITE_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      headers: Record<string, string | string[] | undefined>;
      tenant?: TenantContext;
    }>();

    const tenantId = request.headers[TENANT_HEADER];
    if (!tenantId || Array.isArray(tenantId)) {
      throw new BadRequestException('Header X-Tenant-Id é obrigatório');
    }

    if (!request.user) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId: request.user.userId } },
      include: {
        branches: { select: { branchId: true } },
        tenant: {
          select: {
            trialEndsAt: true,
            subscription: {
              select: { status: true, currentPeriodEnd: true },
            },
          },
        },
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('Você não tem acesso a esta distribuidora');
    }

    const staleBefore = new Date(Date.now() - LAST_ACCESS_WRITE_INTERVAL_MS);
    if (!membership.lastAccessAt || membership.lastAccessAt < staleBefore) {
      await this.prisma.membership.update({
        where: { id: membership.id },
        data: { lastAccessAt: new Date() },
      });
    }

    const subscription = membership.tenant.subscription;
    const status =
      subscription &&
      effectiveSubscriptionStatus({
        ...subscription,
        trialEndsAt: membership.tenant.trialEndsAt,
      });
    if (subscription && status && status !== subscription.status) {
      await this.prisma.subscription.updateMany({
        where: { tenantId, status: subscription.status },
        data: { status },
      });
    }

    request.tenant = {
      tenantId,
      userId: request.user.userId,
      membershipId: membership.id,
      role: membership.role,
      allowedBranchIds: FULL_ACCESS_ROLES.includes(membership.role)
        ? null
        : membership.branches.map((b) => b.branchId),
      readOnly: status ? isReadOnlyStatus(status) : false,
    };

    return true;
  }
}
