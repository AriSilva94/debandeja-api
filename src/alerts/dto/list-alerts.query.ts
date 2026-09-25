import { IsOptional, IsUUID } from 'class-validator';

export class ListAlertsQuery {
  @IsOptional()
  @IsUUID('4')
  branchId?: string;
}
