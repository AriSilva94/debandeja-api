import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { BR_UF_CODES } from '../../common/constants/br-states';
import { DigitsOnly, TrimToNull } from '../../common/validation/transforms';

export const TAX_REGIMES = [
  'Simples Nacional',
  'Lucro Presumido',
  'Lucro Real',
] as const;

export class UpdateCompanyDto {
  @ValidateIf((dto: UpdateCompanyDto) => dto.legalName !== undefined)
  @TrimToNull()
  @IsString({ message: 'Informe o nome da empresa' })
  @MinLength(2)
  legalName?: string;

  @IsOptional()
  @TrimToNull()
  @IsString()
  tradeName?: string | null;

  @IsOptional()
  @DigitsOnly()
  @Length(14, 14, { message: 'CNPJ deve ter 14 dígitos' })
  cnpj?: string | null;

  @IsOptional()
  @TrimToNull()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @TrimToNull()
  @IsEmail({}, { message: 'E-mail de contato inválido' })
  contactEmail?: string | null;

  @IsOptional()
  @TrimToNull()
  @IsString()
  address?: string | null;

  @IsOptional()
  @TrimToNull()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsIn(BR_UF_CODES)
  uf?: string | null;

  @IsOptional()
  @DigitsOnly()
  @Length(8, 8, { message: 'CEP deve ter 8 dígitos' })
  zip?: string | null;

  @IsOptional()
  @TrimToNull()
  @IsString()
  stateRegistration?: string | null;

  @IsOptional()
  @IsIn(TAX_REGIMES)
  taxRegime?: string | null;
}
