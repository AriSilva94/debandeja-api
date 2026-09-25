import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsQuery } from './dto/list-products.query';

@Controller('products')
@UseGuards(TenantGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermission(PermissionModule.PRODUCTS, PermissionLevel.READ)
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListProductsQuery,
  ) {
    return this.productsService.list(tenant, query);
  }

  @Get('categories')
  @RequirePermission(PermissionModule.PRODUCTS, PermissionLevel.READ)
  categories(@CurrentTenant() tenant: TenantContext) {
    return this.productsService.categories(tenant.tenantId);
  }

  @Post()
  @RequirePermission(PermissionModule.PRODUCTS, PermissionLevel.WRITE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(tenant, dto);
  }

  @Patch(':id')
  @RequirePermission(PermissionModule.PRODUCTS, PermissionLevel.WRITE)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(tenant.tenantId, id, dto);
  }

  @Post(':id/duplicate')
  @RequirePermission(PermissionModule.PRODUCTS, PermissionLevel.WRITE)
  duplicate(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.productsService.duplicate(tenant.tenantId, id);
  }

  @Delete(':id')
  @RequirePermission(PermissionModule.PRODUCTS, PermissionLevel.WRITE)
  remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.productsService.remove(tenant.tenantId, id);
  }
}
