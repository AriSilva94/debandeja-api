import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { INVITABLE_ROLES } from '../../common/permissions/invitable-roles';
import { Role } from '../../../generated/prisma/enums';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsIn(INVITABLE_ROLES)
  role: Role;

  @ValidateIf((dto: InviteMemberDto) => dto.role !== Role.ADMIN)
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  branchIds?: string[];
}
