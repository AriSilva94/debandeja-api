import { IsIn, IsString, MinLength } from 'class-validator';
import { BR_UF_CODES } from '../../common/constants/br-states';

export class CreateBranchDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  city: string;

  @IsIn(BR_UF_CODES)
  uf: string;
}
