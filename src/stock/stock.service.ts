import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PrismaTx } from '../common/prisma/tx-client.type';
import { levelFor } from '../common/stock/level';
import { ListStockQuery } from './dto/list-stock.query';
import type { TenantContext } from '../common/tenant/tenant-context';
import { resolveBranchScope } from '../common/tenant/resolve-branch-scope';

function isOperational(
  product: { active: boolean },
  branch: { active: boolean },
) {
  return product.active && branch.active;
}

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenant: TenantContext, query: ListStockQuery) {
    const branchIds = await resolveBranchScope(
      this.prisma,
      tenant,
      query.branchId,
    );
    const where: Prisma.StockWhereInput = {
      tenantId: tenant.tenantId,
      ...(branchIds ? { branchId: { in: branchIds } } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.search
        ? {
            product: {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { sku: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const rows = await this.prisma.stock.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            minStock: true,
            active: true,
          },
        },
        branch: { select: { id: true, name: true, active: true } },
      },
      orderBy: { product: { name: 'asc' } },
    });

    const enriched = rows.map((row) => {
      const effectiveMin = row.minStockOverride ?? row.product.minStock;
      const available = row.current - row.reserved;
      return {
        id: row.id,
        product: row.product,
        branch: row.branch,
        current: row.current,
        reserved: row.reserved,
        available,
        minStock: effectiveMin,
        level: levelFor(row.current, effectiveMin),
      };
    });

    const kpis = {
      totalItems: enriched.reduce((sum, r) => sum + r.current, 0),
      lowCount: enriched.filter(
        (r) => r.level === 'low' && isOperational(r.product, r.branch),
      ).length,
      outCount: enriched.filter(
        (r) => r.level === 'out' && isOperational(r.product, r.branch),
      ).length,
      reserved: enriched.reduce((sum, r) => sum + r.reserved, 0),
    };

    const filtered = query.status
      ? enriched.filter((r) => r.level === query.status)
      : enriched;

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const items = filtered.slice((page - 1) * pageSize, page * pageSize);

    return { items, total: filtered.length, page, pageSize, kpis };
  }

  async summary(tenantId: string, branchIds?: string[]) {
    const rows = await this.prisma.stock.findMany({
      where: {
        tenantId,
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
      },
      select: {
        current: true,
        reserved: true,
        minStockOverride: true,
        product: { select: { minStock: true, active: true } },
        branch: { select: { active: true } },
      },
    });

    let totalItems = 0;
    let reserved = 0;
    let lowCount = 0;
    let outCount = 0;

    for (const row of rows) {
      totalItems += row.current;
      reserved += row.reserved;
      if (!isOperational(row.product, row.branch)) continue;
      const level = levelFor(
        row.current,
        row.minStockOverride ?? row.product.minStock,
      );
      if (level === 'low') lowCount++;
      if (level === 'out') outCount++;
    }

    return { totalItems, reserved, lowCount, outCount };
  }

  async alerts(tenantId: string, branchIds?: string[]) {
    const rows = await this.prisma.stock.findMany({
      where: {
        tenantId,
        product: { active: true },
        branch: { active: true },
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, minStock: true },
        },
        branch: { select: { id: true, name: true } },
      },
    });

    return rows
      .map((row) => {
        const effectiveMin = row.minStockOverride ?? row.product.minStock;
        return {
          product: row.product,
          branch: row.branch,
          current: row.current,
          min: effectiveMin,
          level: levelFor(row.current, effectiveMin),
        };
      })
      .filter((row) => row.level !== 'ok')
      .sort((a, b) => a.current - b.current);
  }

  async ensureStockForNewProduct(
    tenantId: string,
    productId: string,
    initialByBranch: Record<string, number> = {},
    tx: PrismaTx = this.prisma,
  ) {
    const branches = await tx.branch.findMany({
      where: { tenantId, active: true },
      select: { id: true },
    });
    if (branches.length === 0) return;

    await tx.stock.createMany({
      data: branches.map((b) => ({
        tenantId,
        productId,
        branchId: b.id,
        current: initialByBranch[b.id] ?? 0,
      })),
      skipDuplicates: true,
    });
  }

  async ensureStockForNewBranch(
    tenantId: string,
    branchId: string,
    tx: PrismaTx = this.prisma,
  ) {
    const products = await tx.product.findMany({
      where: { tenantId, active: true },
      select: { id: true },
    });
    if (products.length === 0) return;

    await tx.stock.createMany({
      data: products.map((p) => ({
        tenantId,
        productId: p.id,
        branchId,
        current: 0,
      })),
      skipDuplicates: true,
    });
  }
}
