import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PrismaTx } from '../common/prisma/tx-client.type';
import type { TenantContext } from '../common/tenant/tenant-context';
import { assertPlanAllows, lockTenant } from '../common/plan/plan-limits';
import { StockService } from '../stock/stock.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  list(tenant: TenantContext) {
    return this.prisma.branch.findMany({
      where: {
        tenantId: tenant.tenantId,
        ...(tenant.allowedBranchIds !== null
          ? { id: { in: tenant.allowedBranchIds } }
          : {}),
      },
      orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(tenantId: string, dto: CreateBranchDto) {
    await this.assertNameAvailable(tenantId, dto.name);

    return this.withUniqueName(() =>
      this.prisma.$transaction(async (tx) => {
        await lockTenant(tx, tenantId);
        await this.assertBranchSlot(tx, tenantId);

        const branch = await tx.branch.create({
          data: {
            tenantId,
            name: dto.name,
            city: dto.city,
            uf: dto.uf,
            responsibleName: dto.responsibleName,
          },
        });

        await this.stockService.ensureStockForNewBranch(
          tenantId,
          branch.id,
          tx,
        );

        return branch;
      }),
    );
  }

  async update(tenantId: string, branchId: string, dto: UpdateBranchDto) {
    await this.findOwned(tenantId, branchId);
    if (dto.name) {
      await this.assertNameAvailable(tenantId, dto.name, branchId);
    }

    return this.withUniqueName(() =>
      this.prisma.$transaction(async (tx) => {
        const branch = await this.lockAndReload(tx, tenantId, branchId);
        const reactivating = dto.active === true && !branch.active;

        if (dto.active === false && branch.active) {
          await this.assertCanDeactivate(tx, tenantId, branch);
        }
        if (reactivating) {
          await this.assertBranchSlot(tx, tenantId);
        }

        const updated = await tx.branch.update({
          where: { id: branchId },
          data: {
            name: dto.name,
            city: dto.city,
            uf: dto.uf,
            responsibleName: dto.responsibleName,
            active: dto.active,
          },
        });

        if (reactivating) {
          await this.stockService.ensureStockForNewBranch(
            tenantId,
            branchId,
            tx,
          );
        }

        return updated;
      }),
    );
  }

  async remove(tenantId: string, branchId: string) {
    await this.findOwned(tenantId, branchId);

    return this.prisma.$transaction(async (tx) => {
      const branch = await this.lockAndReload(tx, tenantId, branchId);
      if (!branch.active) return branch;
      await this.assertCanDeactivate(tx, tenantId, branch);

      return tx.branch.update({
        where: { id: branchId },
        data: { active: false },
      });
    });
  }

  private async lockAndReload(
    tx: PrismaTx,
    tenantId: string,
    branchId: string,
  ) {
    await lockTenant(tx, tenantId);
    return tx.branch.findUniqueOrThrow({ where: { id: branchId } });
  }

  private async assertBranchSlot(tx: PrismaTx, tenantId: string) {
    const activeCount = await tx.branch.count({
      where: { tenantId, active: true },
    });
    await assertPlanAllows(tx, tenantId, 'maxBranches', activeCount);
  }

  private async assertNameAvailable(
    tenantId: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.branch.findFirst({
      where: {
        tenantId,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Já existe uma filial com este nome');
    }
  }

  private async withUniqueName<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe uma filial com este nome');
      }
      throw error;
    }
  }

  private async findOwned(tenantId: string, branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch || branch.tenantId !== tenantId) {
      throw new NotFoundException('Filial não encontrada');
    }
    return branch;
  }

  private async assertCanDeactivate(
    tx: PrismaTx,
    tenantId: string,
    branch: { isMain: boolean },
  ) {
    if (branch.isMain) {
      throw new ForbiddenException(
        'A filial principal não pode ser desativada',
      );
    }

    const activeCount = await tx.branch.count({
      where: { tenantId, active: true },
    });
    if (activeCount <= 1) {
      throw new ForbiddenException(
        'A distribuidora precisa manter ao menos uma filial ativa',
      );
    }
  }
}
