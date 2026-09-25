import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../../generated/prisma/enums';
import type { PrismaTx } from '../common/prisma/tx-client.type';
import { CreateMovementDto } from './dto/create-movement.dto';
import { ListMovementsQuery } from './dto/list-movements.query';
import type { TenantContext } from '../common/tenant/tenant-context';
import {
  assertBranchInScope,
  resolveBranchScope,
} from '../common/tenant/resolve-branch-scope';

const MAX_CAS_ATTEMPTS = 5;

@Injectable()
export class MovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenant: TenantContext, query: ListMovementsQuery) {
    const branchIds = await resolveBranchScope(
      this.prisma,
      tenant,
      query.branchId,
    );
    const where = {
      tenantId: tenant.tenantId,
      ...(branchIds ? { branchId: { in: branchIds } } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [items, total] = await Promise.all([
      this.prisma.movement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          branch: { select: { id: true, name: true } },
          member: { select: { user: { select: { name: true } } } },
          reversedBy: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.movement.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async create(tenant: TenantContext, dto: CreateMovementDto) {
    const { tenantId, membershipId } = tenant;
    if (tenant.role === Role.SALES && dto.type !== 'SAIDA') {
      throw new ForbiddenException(
        'Vendedor só pode registrar saídas de estoque',
      );
    }

    const [product, branch] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: dto.productId } }),
      this.prisma.branch.findUnique({ where: { id: dto.branchId } }),
    ]);
    if (!product || product.tenantId !== tenantId) {
      throw new NotFoundException('Produto não encontrado');
    }
    if (!branch || branch.tenantId !== tenantId) {
      throw new NotFoundException('Filial não encontrada');
    }
    assertBranchInScope(tenant, branch.id);
    if (!branch.active) {
      throw new BadRequestException(
        'Filial inativa não recebe movimentações. Reative-a antes.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const { before, after, delta } = await this.applyStockChange(
        tx,
        dto.productId,
        dto.branchId,
        (current) => current + this.computeDelta(dto, current),
      );

      return tx.movement.create({
        data: {
          tenantId,
          branchId: dto.branchId,
          productId: dto.productId,
          memberId: membershipId,
          type: dto.type,
          qty: delta,
          balanceBefore: before,
          balanceAfter: after,
          note: dto.note,
        },
      });
    });
  }

  async reverse(tenant: TenantContext, movementId: string) {
    const { tenantId, membershipId } = tenant;
    const original = await this.prisma.movement.findUnique({
      where: { id: movementId },
      include: { reversedBy: true },
    });
    if (!original || original.tenantId !== tenantId) {
      throw new NotFoundException('Movimentação não encontrada');
    }
    assertBranchInScope(tenant, original.branchId);
    if (tenant.role === Role.SALES) {
      throw new ForbiddenException('Vendedor não pode estornar movimentações');
    }
    if (original.reversesMovementId) {
      throw new ForbiddenException('Não é possível estornar um estorno');
    }
    if (original.reversedBy) {
      throw new ConflictException('Esta movimentação já foi estornada');
    }

    return this.prisma.$transaction(async (tx) => {
      const { before, after } = await this.applyStockChange(
        tx,
        original.productId,
        original.branchId,
        (current) => current - original.qty,
      );

      return tx.movement.create({
        data: {
          tenantId,
          branchId: original.branchId,
          productId: original.productId,
          memberId: membershipId,
          type: original.type,
          qty: -original.qty,
          balanceBefore: before,
          balanceAfter: after,
          note: original.note ? `Estorno · ${original.note}` : 'Estorno',
          reversesMovementId: original.id,
        },
      });
    });
  }

  private computeDelta(dto: CreateMovementDto, current: number): number {
    if (dto.type === 'AJUSTE') {
      if (dto.newQuantity === undefined) {
        throw new BadRequestException('Informe o novo saldo do ajuste');
      }
      return dto.newQuantity - current;
    }
    if (dto.qty === undefined) {
      throw new BadRequestException('Informe a quantidade');
    }
    return dto.type === 'ENTRADA' ? dto.qty : -dto.qty;
  }

  private async applyStockChange(
    tx: PrismaTx,
    productId: string,
    branchId: string,
    computeAfter: (current: number) => number,
  ): Promise<{ before: number; after: number; delta: number }> {
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
      const stock = await tx.stock.findUnique({
        where: { productId_branchId: { productId, branchId } },
      });
      if (!stock) {
        throw new NotFoundException(
          'Não há registro de estoque para este produto nesta filial',
        );
      }

      const before = stock.current;
      const after = computeAfter(before);
      if (after < 0) {
        throw new BadRequestException(
          'Estoque insuficiente para esta operação',
        );
      }

      const result = await tx.stock.updateMany({
        where: { id: stock.id, current: before },
        data: { current: after },
      });

      if (result.count === 1) {
        return { before, after, delta: after - before };
      }
    }
    throw new ConflictException(
      'Não foi possível atualizar o estoque, tente novamente',
    );
  }
}
