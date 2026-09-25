import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentTenant } from '../common/tenant/tenant-context';
import type { TenantContext } from '../common/tenant/tenant-context';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryQuery } from './dto/dashboard-summary.query';

@Controller('dashboard')
@UseGuards(TenantGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  summary(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: DashboardSummaryQuery,
  ) {
    return this.dashboardService.summary(tenant, query);
  }
}
