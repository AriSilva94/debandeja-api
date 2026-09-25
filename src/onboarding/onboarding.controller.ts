import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CurrentTenant } from '../common/tenant/tenant-context';
import type { TenantContext } from '../common/tenant/tenant-context';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import {
  PermissionLevel,
  PermissionModule,
} from '../common/permissions/permission.types';
import { OnboardingService } from './onboarding.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateBranchDto } from './dto/create-branch.dto';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('company')
  createCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCompanyDto,
  ) {
    return this.onboardingService.createCompany(user.userId, dto);
  }

  @Post('branch')
  @UseGuards(TenantGuard, PermissionsGuard)
  @RequirePermission(PermissionModule.BRANCHES, PermissionLevel.WRITE)
  createBranch(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateBranchDto,
  ) {
    return this.onboardingService.createBranch(tenant.tenantId, dto);
  }
}
