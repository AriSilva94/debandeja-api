import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
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
import { MovementsService } from './movements.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { ListMovementsQuery } from './dto/list-movements.query';

@Controller('movements')
@UseGuards(TenantGuard, PermissionsGuard)
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get()
  @RequirePermission(PermissionModule.MOVEMENTS, PermissionLevel.READ)
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListMovementsQuery,
  ) {
    return this.movementsService.list(tenant, query);
  }

  @Post()
  @RequirePermission(PermissionModule.MOVEMENTS, PermissionLevel.WRITE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateMovementDto,
  ) {
    return this.movementsService.create(tenant, dto);
  }

  @Post(':id/reverse')
  @RequirePermission(PermissionModule.MOVEMENTS, PermissionLevel.WRITE)
  reverse(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.movementsService.reverse(tenant, id);
  }
}
