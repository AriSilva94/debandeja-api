import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentTenant } from '../common/tenant/tenant-context';
import type { TenantContext } from '../common/tenant/tenant-context';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import {
  PermissionLevel,
  PermissionModule,
} from '../common/permissions/permission.types';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('company')
@UseGuards(TenantGuard, PermissionsGuard)
@RequirePermission(PermissionModule.COMPANY, PermissionLevel.READ)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  get(@CurrentTenant() tenant: TenantContext) {
    return this.companyService.get(tenant.tenantId);
  }

  @Patch()
  @RequirePermission(PermissionModule.COMPANY, PermissionLevel.WRITE)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companyService.update(tenant.tenantId, dto);
  }
}
