import { IsOptional, IsString, Length, MinLength } from 'class-validator';
import { DigitsOnly } from '../../common/validation/transforms';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  legalName: string;

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsOptional()
  @DigitsOnly()
  @Length(14, 14, { message: 'CNPJ deve ter 14 dígitos' })
  cnpj?: string;
}
