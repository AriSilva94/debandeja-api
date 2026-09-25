import { IsEmail, IsString } from 'class-validator';

export class RequestEmailChangeDto {
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  newEmail: string;

  @IsString()
  currentPassword: string;
}
