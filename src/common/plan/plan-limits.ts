import { ForbiddenException } from '@nestjs/common';
import type { PrismaTx } from '../prisma/tx-client.type';

type LimitedResource = 'maxBranches' | 'maxUsers' | 'maxProducts';

const LABELS: Record<LimitedResource, [singular: string, plural: string]> = {
  maxBranches: ['filial ativa', 'filiais ativas'],
  maxUsers: ['usuário', 'usuários'],
  maxProducts: ['produto ativo', 'produtos ativos'],
};

export async function lockTenant(tx: PrismaTx, tenantId: string) {
  await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId} FOR UPDATE`;
}

export async function assertPlanAllows(
  tx: PrismaTx,
  tenantId: string,
  resource: LimitedResource,
  currentCount: number,
) {
  const subscription = await tx.subscription.findUnique({
    where: { tenantId },
    select: {
      plan: {
        select: {
          name: true,
          maxBranches: true,
          maxUsers: true,
          maxProducts: true,
        },
      },
    },
  });
  const plan = subscription?.plan;
  const limit = plan?.[resource];
  if (!plan || typeof limit !== 'number' || currentCount < limit) return;

  const [singular, plural] = LABELS[resource];
  throw new ForbiddenException(
    `O plano ${plan.name} permite até ${limit} ${limit === 1 ? singular : plural}. Faça upgrade para adicionar mais.`,
  );
}
