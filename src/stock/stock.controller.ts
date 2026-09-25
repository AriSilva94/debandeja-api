import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentTenant } from '../common/tenant/tenant-context';
import type { TenantContext } from '../common/tenant/tenant-context';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import {
  PermissionLevel,
  PermissionModule,
} from '../common/permissions/permission.types';
import { StockService } from './stock.service';
import { ListStockQuery } from './dto/list-stock.query';

@Controller('stock')
@UseGuards(TenantGuard, PermissionsGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @RequirePermission(PermissionModule.STOCK, PermissionLevel.READ)
  list(@CurrentTenant() tenant: TenantContext, @Query() query: ListStockQuery) {
    return this.stockService.list(tenant, query);
  }
}
