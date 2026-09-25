import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { TenantContext } from './tenant-context';

export async function resolveBranchScope(
  prisma: PrismaService,
  tenant: TenantContext,
  queryBranchId?: string,
): Promise<string[] | undefined> {
  if (queryBranchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: queryBranchId },
    });
    if (!branch || branch.tenantId !== tenant.tenantId) {
      throw new NotFoundException('Filial não encontrada');
    }
    if (
      tenant.allowedBranchIds !== null &&
      !tenant.allowedBranchIds.includes(queryBranchId)
    ) {
      throw new ForbiddenException('Você não tem acesso a esta filial');
    }
    return [queryBranchId];
  }

  return tenant.allowedBranchIds === null ? undefined : tenant.allowedBranchIds;
}

export async function assertBranchesBelongToTenant(
  prisma: PrismaService,
  tenantId: string,
  branchIds: string[],
) {
  const count = await prisma.branch.count({
    where: { tenantId, id: { in: branchIds } },
  });
  if (count !== branchIds.length) {
    throw new BadRequestException(
      'Uma ou mais filiais não pertencem a esta distribuidora',
    );
  }
}

export function assertBranchInScope(tenant: TenantContext, branchId: string) {
  if (
    tenant.allowedBranchIds !== null &&
    !tenant.allowedBranchIds.includes(branchId)
  ) {
    throw new ForbiddenException('Você não tem acesso a esta filial');
  }
}
