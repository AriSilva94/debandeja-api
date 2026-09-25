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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import {
  PermissionLevel,
  PermissionModule,
} from '../common/permissions/permission.types';
import { TeamService } from './team.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Controller('team')
@UseGuards(TenantGuard, PermissionsGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @RequirePermission(PermissionModule.TEAM, PermissionLevel.READ)
  list(@CurrentTenant() tenant: TenantContext) {
    return this.teamService.list(tenant.tenantId);
  }

  @Get('roles-matrix')
  @RequirePermission(PermissionModule.TEAM, PermissionLevel.READ)
  rolesMatrix() {
    return this.teamService.rolesMatrix();
  }

  @Post('invite')
  @RequirePermission(PermissionModule.TEAM, PermissionLevel.WRITE)
  invite(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteMemberDto,
  ) {
    return this.teamService.invite(tenant.tenantId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermission(PermissionModule.TEAM, PermissionLevel.WRITE)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.teamService.update(tenant, id, dto);
  }

  @Delete(':id')
  @RequirePermission(PermissionModule.TEAM, PermissionLevel.WRITE)
  remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.teamService.remove(tenant, id);
  }

  @Post(':id/resend-invite')
  @RequirePermission(PermissionModule.TEAM, PermissionLevel.WRITE)
  resendInvite(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.teamService.resendInvite(tenant.tenantId, user.userId, id);
  }
}
