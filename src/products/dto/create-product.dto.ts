import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';
import { PRODUCT_UNITS } from '../../common/constants/product-units';

export class CreateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  sku?: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsString()
  @MinLength(1)
  categoryId: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsIn(PRODUCT_UNITS)
  unit?: (typeof PRODUCT_UNITS)[number];

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsObject()
  initialStockByBranch?: Record<string, number>;
}
