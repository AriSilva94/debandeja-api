import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import type { TenantContext } from '../common/tenant/tenant-context';
import { resolveBranchScope } from '../common/tenant/resolve-branch-scope';
import { ListAlertsQuery } from './dto/list-alerts.query';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async list(tenant: TenantContext, query: ListAlertsQuery) {
    const branchIds = await resolveBranchScope(
      this.prisma,
      tenant,
      query.branchId,
    );
    return this.stockService.alerts(tenant.tenantId, branchIds);
  }
}
