import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { INVITABLE_ROLES } from '../../common/permissions/invitable-roles';
import { Role } from '../../../generated/prisma/enums';

export class UpdateMemberDto {
  @IsOptional()
  @IsIn(INVITABLE_ROLES)
  role?: Role;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  branchIds?: string[];
}
