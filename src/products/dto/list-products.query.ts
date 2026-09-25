import { PaginationQuery } from '../../common/http/pagination.query';
import { IsIn, IsOptional, IsString } from 'class-validator';

const SORT_FIELDS = ['name', 'sku', 'price', 'stock'] as const;
export const PRODUCT_TABS = ['all', 'active', 'inactive', 'alert'] as const;
const STOCK_LEVELS = ['ok', 'low', 'out'] as const;

export type ProductTab = (typeof PRODUCT_TABS)[number];

export class ListProductsQuery extends PaginationQuery {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(PRODUCT_TABS)
  tab?: ProductTab = 'all';

  @IsOptional()
  @IsIn(STOCK_LEVELS)
  level?: (typeof STOCK_LEVELS)[number];

  @IsOptional()
  @IsIn(SORT_FIELDS)
  sortBy?: (typeof SORT_FIELDS)[number] = 'name';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'asc';
}
