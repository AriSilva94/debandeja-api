import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CurrentTenant } from '../common/tenant/tenant-context';
import type { TenantContext } from '../common/tenant/tenant-context';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { MeService } from './me.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { RequestEmailChangeDto } from './dto/request-email-change.dto';

@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.meService.getProfile(user.userId);
  }

  @Get('context')
  @UseGuards(TenantGuard)
  getContext(@CurrentTenant() tenant: TenantContext) {
    return this.meService.getContext(tenant);
  }

  @Get('tenants')
  listTenants(@CurrentUser() user: AuthenticatedUser) {
    return this.meService.listTenants(user.userId);
  }

  @Patch()
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMeDto) {
    return this.meService.update(user.userId, dto);
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.meService.changePassword(user.userId, dto);
  }

  @Get('sessions')
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.meService.listSessions(user.userId, user.sessionId);
  }

  @Delete('sessions/others')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeOtherSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.meService.revokeOtherSessions(user.userId, user.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.meService.revokeSession(user.userId, id);
  }

  @Patch('notification-settings')
  updateNotificationSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.meService.updateNotificationSettings(user.userId, dto);
  }

  @Patch('preferences')
  @UseGuards(TenantGuard)
  updatePreferences(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.meService.updatePreferences(tenant, dto);
  }

  @Post('email')
  requestEmailChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestEmailChangeDto,
  ) {
    return this.meService.requestEmailChange(user.userId, dto);
  }

  @Delete('email')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelEmailChange(@CurrentUser() user: AuthenticatedUser) {
    return this.meService.cancelEmailChange(user.userId);
  }
}
