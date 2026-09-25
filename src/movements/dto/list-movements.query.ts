import { PaginationQuery } from '../../common/http/pagination.query';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { MOVEMENT_TYPES } from '../../common/constants/movement-types';

export class ListMovementsQuery extends PaginationQuery {
  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @IsOptional()
  @IsUUID('4')
  productId?: string;

  @IsOptional()
  @IsIn(MOVEMENT_TYPES)
  type?: (typeof MOVEMENT_TYPES)[number];

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
