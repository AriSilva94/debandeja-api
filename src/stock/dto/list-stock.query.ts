import { PaginationQuery } from '../../common/http/pagination.query';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const STOCK_STATUSES = ['ok', 'low', 'out'] as const;

export class ListStockQuery extends PaginationQuery {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @IsOptional()
  @IsUUID('4')
  productId?: string;

  @IsOptional()
  @IsIn(STOCK_STATUSES)
  status?: (typeof STOCK_STATUSES)[number];
}
