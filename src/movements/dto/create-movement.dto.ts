import {
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { MOVEMENT_TYPES } from '../../common/constants/movement-types';

export class CreateMovementDto {
  @IsUUID('4')
  productId: string;

  @IsUUID('4')
  branchId: string;

  @IsIn(MOVEMENT_TYPES)
  type: (typeof MOVEMENT_TYPES)[number];

  @ValidateIf(
    (o: CreateMovementDto) => o.type === 'ENTRADA' || o.type === 'SAIDA',
  )
  @IsInt()
  @IsPositive()
  qty?: number;

  @ValidateIf((o: CreateMovementDto) => o.type === 'AJUSTE')
  @IsInt()
  @Min(0)
  newQuantity?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
