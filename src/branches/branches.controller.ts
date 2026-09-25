import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentTenant } from '../common/tenant/tenant-context';
import type { TenantContext } from '../common/tenant/tenant-context';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import {
  PermissionLevel,
  PermissionModule,
} from '../common/permissions/permission.types';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branches')
@UseGuards(TenantGuard, PermissionsGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext) {
    return this.branchesService.list(tenant);
  }

  @Post()
  @RequirePermission(PermissionModule.BRANCHES, PermissionLevel.WRITE)
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(tenant.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission(PermissionModule.BRANCHES, PermissionLevel.WRITE)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(tenant.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission(PermissionModule.BRANCHES, PermissionLevel.WRITE)
  remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.branchesService.remove(tenant.tenantId, id);
  }
}
