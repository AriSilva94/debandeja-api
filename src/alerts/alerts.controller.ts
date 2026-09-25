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
import { AlertsService } from './alerts.service';
import { ListAlertsQuery } from './dto/list-alerts.query';

@Controller('alerts')
@UseGuards(TenantGuard, PermissionsGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @RequirePermission(PermissionModule.STOCK, PermissionLevel.READ)
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListAlertsQuery,
  ) {
    return this.alertsService.list(tenant, query);
  }
}
