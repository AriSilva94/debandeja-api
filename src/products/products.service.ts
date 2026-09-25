import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsQuery, type ProductTab } from './dto/list-products.query';
import type { StockLevel } from '../common/stock/level';
import type { TenantContext } from '../common/tenant/tenant-context';
import type { PrismaTx } from '../common/prisma/tx-client.type';
import {
  assertBranchInScope,
  assertBranchesBelongToTenant,
} from '../common/tenant/resolve-branch-scope';
import { assertPlanAllows, lockTenant } from '../common/plan/plan-limits';

type ProductListRow = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string;
  barcode: string | null;
  unit: string;
  price: Prisma.Decimal;
  minStock: number;
  active: boolean;
  imageUrl: string | null;
  stock: number;
  minTotal: number;
  level: StockLevel;
};

const TAB_CONDITIONS: Record<ProductTab, Prisma.Sql> = {
  all: Prisma.sql`TRUE`,
  active: Prisma.sql`active = TRUE`,
  inactive: Prisma.sql`active = FALSE`,
  alert: Prisma.sql`active = TRUE AND level IN ('low', 'out')`,
};

const SORT_COLUMNS: Record<
  NonNullable<ListProductsQuery['sortBy']>,
  Prisma.Sql
> = {
  name: Prisma.sql`name`,
  sku: Prisma.sql`sku`,
  price: Prisma.sql`price`,
  stock: Prisma.sql`stock`,
};

function stockScope(tenant: TenantContext) {
  if (tenant.allowedBranchIds === null) return Prisma.empty;
  if (tenant.allowedBranchIds.length === 0) return Prisma.sql`AND FALSE`;
  return Prisma.sql`AND s."branchId" IN (${Prisma.join(tenant.allowedBranchIds)})`;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async list(tenant: TenantContext, query: ListProductsQuery) {
    const { tenantId } = tenant;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const tab = query.tab ?? 'all';

    const conditions = [Prisma.sql`p."tenantId" = ${tenantId}`];
    if (query.category) {
      conditions.push(Prisma.sql`pc.name = ${query.category}`);
    }
    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(
        Prisma.sql`(p.name ILIKE ${pattern} OR p.sku ILIKE ${pattern} OR p.brand ILIKE ${pattern})`,
      );
    }

    const filtered = Prisma.sql`
      WITH aggregated AS (
        SELECT p.id, p."categoryId", p.sku, p.name, p.brand, pc.name AS category, p.barcode, p.unit,
               p.price, p."minStock", p.active, p."imageUrl",
               COALESCE(SUM(s.current), 0)::int AS stock,
               COALESCE(SUM(COALESCE(s."minStockOverride", p."minStock")), 0)::int AS "minTotal"
        FROM products p
        INNER JOIN product_categories pc ON pc.id = p."categoryId"
        LEFT JOIN stocks s ON s."productId" = p.id ${stockScope(tenant)}
        WHERE ${Prisma.join(conditions, ' AND ')}
        GROUP BY p.id, pc.name
      ),
      leveled AS (
        SELECT *, CASE
          WHEN stock <= 0 THEN 'out'
          WHEN stock < "minTotal" THEN 'low'
          ELSE 'ok'
        END AS level
        FROM aggregated
      ),
      filtered AS (
        SELECT * FROM leveled
        ${query.level ? Prisma.sql`WHERE level = ${query.level}` : Prisma.empty}
      )`;

    const sortColumn = SORT_COLUMNS[query.sortBy ?? 'name'];
    const sortDir =
      query.sortDir === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;

    const [items, [counts]] = await Promise.all([
      this.prisma.$queryRaw<ProductListRow[]>`
        ${filtered}
        SELECT * FROM filtered
        WHERE ${TAB_CONDITIONS[tab]}
        ORDER BY ${sortColumn} ${sortDir}, id
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      this.prisma.$queryRaw<[Record<ProductTab, number>]>`
        ${filtered}
        SELECT
          count(*)::int AS "all",
          (count(*) FILTER (WHERE ${TAB_CONDITIONS.active}))::int AS active,
          (count(*) FILTER (WHERE ${TAB_CONDITIONS.inactive}))::int AS inactive,
          (count(*) FILTER (WHERE ${TAB_CONDITIONS.alert}))::int AS alert
        FROM filtered`,
    ]);

    return { items, total: counts[tab], page, pageSize, counts };
  }

  categories(tenantId: string) {
    return this.prisma.productCategory.findMany({
      where: { tenantId, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(tenant: TenantContext, dto: CreateProductDto) {
    const { tenantId } = tenant;
    if (dto.initialStockByBranch) {
      const branchIds = Object.keys(dto.initialStockByBranch);
      await assertBranchesBelongToTenant(this.prisma, tenantId, branchIds);
      branchIds.forEach((branchId) => assertBranchInScope(tenant, branchId));
      this.assertValidStockQuantities(dto.initialStockByBranch);
    }

    return this.prisma.$transaction(async (tx) => {
      const category = await this.assertOwnedActiveCategory(
        tx,
        tenantId,
        dto.categoryId,
      );
      const sku = await this.generateSku(
        tx,
        tenantId,
        String(category.name),
        dto.name,
      );
      if (dto.active !== false) {
        await this.assertProductSlot(tx, tenantId);
      }
      const product = await tx.product.create({
        data: {
          tenantId,
          sku,
          name: dto.name,
          brand: dto.brand,
          categoryId: dto.categoryId,
          barcode: dto.barcode,
          unit: dto.unit,
          price: dto.price,
          minStock: dto.minStock,
          active: dto.active,
          imageUrl: dto.imageUrl,
        },
      });

      await this.stockService.ensureStockForNewProduct(
        tenantId,
        product.id,
        dto.initialStockByBranch,
        tx,
      );

      return product;
    });
  }

  async update(tenantId: string, productId: string, dto: UpdateProductDto) {
    const current = await this.findOwned(tenantId, productId);

    if (dto.categoryId) {
      await this.assertOwnedActiveCategory(
        this.prisma,
        tenantId,
        dto.categoryId,
      );
    }

    if (dto.active === true && !current.active) {
      return this.prisma.$transaction(async (tx) => {
        await this.assertProductSlot(tx, tenantId);
        const product = await tx.product.update({
          where: { id: productId },
          data: this.updateData(dto),
        });
        await this.stockService.ensureStockForNewProduct(
          tenantId,
          productId,
          {},
          tx,
        );
        return product;
      });
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: this.updateData(dto),
    });
  }

  private updateData(dto: UpdateProductDto) {
    return {
      name: dto.name,
      brand: dto.brand,
      categoryId: dto.categoryId,
      barcode: dto.barcode,
      unit: dto.unit,
      price: dto.price,
      minStock: dto.minStock,
      active: dto.active,
      imageUrl: dto.imageUrl,
    };
  }

  async remove(tenantId: string, productId: string) {
    await this.findOwned(tenantId, productId);
    return this.prisma.product.update({
      where: { id: productId },
      data: { active: false },
    });
  }

  async duplicate(tenantId: string, productId: string) {
    const source = await this.findOwned(tenantId, productId);
    const sku = await this.generateCopySku(tenantId, source.sku);

    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnedActiveCategory(tx, tenantId, source.categoryId);
      if (source.active) {
        await this.assertProductSlot(tx, tenantId);
      }
      const product = await tx.product.create({
        data: {
          tenantId,
          sku,
          name: `${source.name} (cópia)`,
          brand: source.brand,
          categoryId: source.categoryId,
          barcode: null,
          unit: source.unit,
          price: source.price,
          minStock: source.minStock,
          active: source.active,
          imageUrl: source.imageUrl,
        },
      });

      await this.stockService.ensureStockForNewProduct(
        tenantId,
        product.id,
        {},
        tx,
      );

      return product;
    });
  }

  private async assertProductSlot(tx: PrismaTx, tenantId: string) {
    await lockTenant(tx, tenantId);
    const activeCount = await tx.product.count({
      where: { tenantId, active: true },
    });
    await assertPlanAllows(tx, tenantId, 'maxProducts', activeCount);
  }

  private async assertOwnedActiveCategory(
    prisma: Pick<PrismaService, 'productCategory'>,
    tenantId: string,
    categoryId: string,
  ) {
    const category = await prisma.productCategory.findFirst({
      where: { id: categoryId, tenantId, active: true },
      select: { id: true, name: true },
    });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }
    return category;
  }

  private async generateSku(
    prisma: PrismaTx,
    tenantId: string,
    category: string,
    name: string,
  ) {
    const abbreviate = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.slice(0, 3));
    const base = [
      ...abbreviate(category).slice(0, 1),
      ...abbreviate(name).slice(0, 3),
    ].join('-');
    const latest = await prisma.product.findFirst({
      where: { tenantId, sku: { startsWith: `${base}-` } },
      orderBy: { sku: 'desc' },
      select: { sku: true },
    });
    const sequence = Number(latest?.sku.split('-').at(-1) ?? 0) + 1;
    return `${base}-${String(sequence).padStart(3, '0')}`;
  }

  private async findOwned(tenantId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product || product.tenantId !== tenantId) {
      throw new NotFoundException('Produto não encontrado');
    }
    return product;
  }

  private async assertSkuAvailable(
    tenantId: string,
    sku: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.product.findUnique({
      where: { tenantId_sku: { tenantId, sku } },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Já existe um produto com este SKU');
    }
  }

  private assertValidStockQuantities(
    initialStockByBranch: Record<string, number>,
  ) {
    const invalid = Object.values(initialStockByBranch).some(
      (qty) => !Number.isInteger(qty) || qty < 0,
    );
    if (invalid) {
      throw new BadRequestException(
        'A quantidade inicial de estoque deve ser um inteiro não negativo',
      );
    }
  }

  private async generateCopySku(
    tenantId: string,
    baseSku: string,
  ): Promise<string> {
    let suffix = 1;
    let candidate = `${baseSku}-COPIA`;
    while (
      await this.prisma.product.findUnique({
        where: { tenantId_sku: { tenantId, sku: candidate } },
      })
    ) {
      suffix += 1;
      candidate = `${baseSku}-COPIA-${suffix}`;
    }
    return candidate;
  }
}
