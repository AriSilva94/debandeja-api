import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class DashboardSummaryQuery {
  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;
}
