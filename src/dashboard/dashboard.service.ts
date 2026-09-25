import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import type { TenantContext } from '../common/tenant/tenant-context';
import { resolveBranchScope } from '../common/tenant/resolve-branch-scope';
import { DashboardSummaryQuery } from './dto/dashboard-summary.query';

const DEFAULT_PERIOD_DAYS = 7;

type BranchStockRow = {
  id: string;
  name: string;
  city: string | null;
  uf: string | null;
  active: boolean;
  items: number;
  skus: number;
  lowCount: number;
  outCount: number;
  entries: number;
  exits: number;
  adjustments: number;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async summary(tenant: TenantContext, query: DashboardSummaryQuery) {
    const branchIds = await resolveBranchScope(
      this.prisma,
      tenant,
      query.branchId,
    );
    const periodStart = query.dateFrom
      ? new Date(query.dateFrom)
      : new Date(Date.now() - DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const branchFilter = branchIds ? { branchId: { in: branchIds } } : {};

    const [
      totalProducts,
      newProductsInPeriod,
      stockSummary,
      movementsInPeriod,
      activeBranchesCount,
      inactiveBranchesCount,
      byBranch,
      recentMovements,
    ] = await Promise.all([
      this.prisma.product.count({
        where: { tenantId: tenant.tenantId, active: true },
      }),
      this.prisma.product.count({
        where: { tenantId: tenant.tenantId, createdAt: { gte: periodStart } },
      }),
      this.stockService.summary(tenant.tenantId, branchIds),
      this.prisma.movement.aggregate({
        where: {
          tenantId: tenant.tenantId,
          createdAt: { gte: periodStart },
          ...branchFilter,
        },
        _sum: { qty: true },
        _count: { _all: true },
      }),
      this.prisma.branch.count({
        where: {
          tenantId: tenant.tenantId,
          active: true,
          ...(branchIds ? { id: { in: branchIds } } : {}),
        },
      }),
      this.prisma.branch.count({
        where: {
          tenantId: tenant.tenantId,
          active: false,
          ...(branchIds ? { id: { in: branchIds } } : {}),
        },
      }),
      this.stockByBranch(tenant.tenantId, branchIds, periodStart),
      this.prisma.movement.findMany({
        where: { tenantId: tenant.tenantId, ...branchFilter },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          branch: { select: { id: true, name: true } },
          member: { select: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ]);

    return {
      totalProducts,
      newProductsInPeriod,
      totalStockItems: stockSummary.totalItems,
      stockItemsDeltaInPeriod: movementsInPeriod._sum.qty ?? 0,
      movementsInPeriod: movementsInPeriod._count._all,
      lowStockCount: stockSummary.lowCount,
      outOfStockCount: stockSummary.outCount,
      activeBranchesCount,
      inactiveBranchesCount,
      reservedItems: stockSummary.reserved,
      byBranch,
      recentMovements,
    };
  }

  private stockByBranch(
    tenantId: string,
    branchIds: string[] | undefined,
    periodStart: Date,
  ) {
    const scope =
      branchIds === undefined
        ? Prisma.empty
        : branchIds.length === 0
          ? Prisma.sql`AND FALSE`
          : Prisma.sql`AND b.id IN (${Prisma.join(branchIds)})`;

    return this.prisma.$queryRaw<BranchStockRow[]>`
      WITH stock_agg AS (
        SELECT s."branchId",
               SUM(s.current) AS items,
               COUNT(*) FILTER (WHERE s.current > 0) AS skus,
               COUNT(*) FILTER (
                 WHERE p.active
                   AND s.current > 0
                   AND s.current < COALESCE(s."minStockOverride", p."minStock")
               ) AS low,
               COUNT(*) FILTER (WHERE p.active AND s.current <= 0) AS out
        FROM stocks s
        JOIN products p ON p.id = s."productId"
        WHERE s."tenantId" = ${tenantId}
        GROUP BY s."branchId"
      ),
      movement_agg AS (
        SELECT "branchId",
               SUM(qty) FILTER (WHERE type = 'ENTRADA') AS entries,
               SUM(qty) FILTER (WHERE type = 'SAIDA') AS exits,
               COUNT(*) FILTER (WHERE type = 'AJUSTE') AS adjustments
        FROM movements
        WHERE "tenantId" = ${tenantId} AND "createdAt" >= ${periodStart}
        GROUP BY "branchId"
      )
      SELECT b.id, b.name, b.city, b.uf, b.active,
             COALESCE(sa.items, 0)::int AS items,
             COALESCE(sa.skus, 0)::int AS skus,
             (CASE WHEN b.active THEN COALESCE(sa.low, 0) ELSE 0 END)::int AS "lowCount",
             (CASE WHEN b.active THEN COALESCE(sa.out, 0) ELSE 0 END)::int AS "outCount",
             COALESCE(ma.entries, 0)::int AS entries,
             COALESCE(ma.exits, 0)::int AS exits,
             COALESCE(ma.adjustments, 0)::int AS adjustments
      FROM branches b
      LEFT JOIN stock_agg sa ON sa."branchId" = b.id
      LEFT JOIN movement_agg ma ON ma."branchId" = b.id
      WHERE b."tenantId" = ${tenantId} ${scope}
        AND (b.active OR COALESCE(sa.items, 0) > 0)
      ORDER BY b.active DESC, b."isMain" DESC, b."createdAt" ASC`;
  }
}
