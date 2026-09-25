import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentTenant } from '../common/tenant/tenant-context';
import type { TenantContext } from '../common/tenant/tenant-context';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import {
  PermissionLevel,
  PermissionModule,
} from '../common/permissions/permission.types';
import { BillingService } from './billing.service';

@Controller('billing')
@UseGuards(TenantGuard, PermissionsGuard)
@RequirePermission(PermissionModule.BILLING, PermissionLevel.READ)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  listPlans(@CurrentTenant() tenant: TenantContext) {
    return this.billingService.listPlans(tenant.tenantId);
  }

  @Get('subscription')
  getSubscription(@CurrentTenant() tenant: TenantContext) {
    return this.billingService.getSubscription(tenant.tenantId);
  }

  @Get('invoices')
  listInvoices(@CurrentTenant() tenant: TenantContext) {
    return this.billingService.listInvoices(tenant.tenantId);
  }

  @Get('invoices/:id/download')
  async downloadInvoice(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const url = await this.billingService.getInvoiceDownloadUrl(
      tenant.tenantId,
      id,
    );
    res.redirect(url);
  }
}
