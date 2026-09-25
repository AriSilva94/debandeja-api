import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  DEFAULT_SCREENS,
  DENSITIES,
  PAGE_SIZES,
  type Preferences,
} from '../../common/membership/preferences';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsUUID('4')
  defaultBranchId?: string | null;

  @IsOptional()
  @IsBoolean()
  lowStockEmailAlert?: boolean;

  @IsOptional()
  @IsBoolean()
  confirmBeforeExit?: boolean;

  @IsOptional()
  @IsIn(DENSITIES)
  density?: Preferences['density'];

  @IsOptional()
  @IsIn(PAGE_SIZES)
  pageSize?: Preferences['pageSize'];

  @IsOptional()
  @IsIn(DEFAULT_SCREENS)
  defaultScreen?: Preferences['defaultScreen'];
}
