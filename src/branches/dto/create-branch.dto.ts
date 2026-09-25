import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { BR_UF_CODES } from '../../common/constants/br-states';

export class CreateBranchDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsIn(BR_UF_CODES)
  uf?: string;

  @IsOptional()
  @IsString()
  responsibleName?: string;
}
