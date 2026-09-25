import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  AuthService,
  type RegisterResult,
  type SessionResult,
} from './auth.service';
import { Public } from './decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { AuthTokens } from './types/jwt-payload.type';
import { clientIp } from '../common/http/client-ip';
import { BRUTE_FORCE_THROTTLE } from '../common/http/throttle';
import { InternalBffGuard } from '../common/http/internal-bff.guard';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle(BRUTE_FORCE_THROTTLE)
  register(@Body() dto: RegisterDto): Promise<RegisterResult> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(BRUTE_FORCE_THROTTLE)
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<SessionResult> {
    return this.authService.login(dto, sessionMetaFrom(req));
  }

  @Post('google')
  @UseGuards(InternalBffGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle(BRUTE_FORCE_THROTTLE)
  googleLogin(
    @Body() dto: GoogleLoginDto,
    @Req() req: Request,
  ): Promise<SessionResult> {
    return this.authService.loginWithGoogle(
      dto.idToken,
      dto.nonce,
      sessionMetaFrom(req),
    );
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle(BRUTE_FORCE_THROTTLE)
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<SessionResult> {
    return this.authService.verifyEmail(dto);
  }

  @Post('confirm-email-change')
  @HttpCode(HttpStatus.OK)
  @Throttle(BRUTE_FORCE_THROTTLE)
  confirmEmailChange(@Body() dto: VerifyEmailDto) {
    return this.authService.confirmEmailChange(dto);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle(BRUTE_FORCE_THROTTLE)
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(BRUTE_FORCE_THROTTLE)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(BRUTE_FORCE_THROTTLE)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto, @Req() req: Request): Promise<AuthTokens> {
    return this.authService.refresh(dto.refreshToken, sessionMetaFrom(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() dto: RefreshDto): Promise<void> {
    return this.authService.logout(dto.refreshToken);
  }
}

function sessionMetaFrom(req: Request) {
  return {
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  };
}
