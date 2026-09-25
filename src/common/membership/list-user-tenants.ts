import { PrismaService } from '../../prisma/prisma.service';
import { MembershipStatus } from '../../../generated/prisma/enums';
import {
  DEFAULT_PREFERENCES,
  withDefaults,
  type Preferences,
} from './preferences';

export type UserTenantSummary = {
  tenantId: string;
  name: string;
  role: string;
  defaultScreen: Preferences['defaultScreen'];
};

export async function listUserTenants(
  prisma: PrismaService,
  userId: string,
): Promise<UserTenantSummary[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId, status: MembershipStatus.ACTIVE },
    select: {
      role: true,
      preferences: true,
      tenant: { select: { id: true, legalName: true, tradeName: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return memberships.map((m) => ({
    tenantId: m.tenant.id,
    name: m.tenant.tradeName ?? m.tenant.legalName,
    role: m.role,
    defaultScreen: withDefaults(DEFAULT_PREFERENCES, m.preferences)
      .defaultScreen,
  }));
}
