import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  dailySummary?: boolean;

  @IsOptional()
  @IsBoolean()
  inviteAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  productNews?: boolean;
}
