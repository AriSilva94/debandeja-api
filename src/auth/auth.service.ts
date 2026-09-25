import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { StringValue } from 'ms';
import { nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import {
  listUserTenants,
  type UserTenantSummary,
} from '../common/membership/list-user-tenants';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { AuthTokens, JwtPayload } from './types/jwt-payload.type';

type SessionMeta = {
  deviceLabel?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type RegisterResult = {
  status: 'verification_pending';
  email: string;
};

export type SessionResult = AuthTokens & { tenants: UserTenantSummary[] };

const REFRESH_SECRET_LENGTH = 48;
const VERIFICATION_SECRET_LENGTH = 32;
const PASSWORD_RESET_SECRET_LENGTH = 32;
const GENERIC_RESEND_MESSAGE =
  'Se este e-mail estiver cadastrado e pendente de verificação, enviamos um novo link.';
const GENERIC_FORGOT_PASSWORD_MESSAGE =
  'Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, passwordHash },
    });

    await this.issueAndSendVerification(user.id, user.name, user.email);

    return { status: 'verification_pending', email: user.email };
  }

  async login(dto: LoginDto, meta: SessionMeta = {}): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Confirme seu e-mail antes de entrar');
    }

    return this.issueTokensWithTenants(user.id, meta);
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<SessionResult> {
    const { userId, secret } = this.parseToken(dto.token);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user ||
      !user.emailVerificationTokenHash ||
      !user.emailVerificationTokenExpiresAt ||
      user.emailVerificationTokenExpiresAt < new Date()
    ) {
      throw new UnauthorizedException(
        'Link de verificação inválido ou expirado',
      );
    }

    const valid = await argon2.verify(user.emailVerificationTokenHash, secret);
    if (!valid) {
      throw new UnauthorizedException(
        'Link de verificação inválido ou expirado',
      );
    }

    const updated = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        emailVerificationTokenHash: user.emailVerificationTokenHash,
      },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationTokenExpiresAt: null,
      },
    });
    if (updated.count === 0) {
      throw new UnauthorizedException(
        'Link de verificação inválido ou expirado',
      );
    }

    return this.issueTokensWithTenants(user.id);
  }

  async confirmEmailChange(dto: VerifyEmailDto): Promise<{ email: string }> {
    const { userId, secret } = this.parseToken(dto.token);
    const invalid = new UnauthorizedException(
      'Link de confirmação inválido ou expirado',
    );

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user?.pendingEmail ||
      !user.emailChangeTokenHash ||
      !user.emailChangeTokenExpiresAt ||
      user.emailChangeTokenExpiresAt < new Date() ||
      !(await argon2.verify(user.emailChangeTokenHash, secret))
    ) {
      throw invalid;
    }

    try {
      const updated = await this.prisma.user.updateMany({
        where: { id: user.id, emailChangeTokenHash: user.emailChangeTokenHash },
        data: {
          email: user.pendingEmail,
          emailVerifiedAt: new Date(),
          pendingEmail: null,
          emailChangeTokenHash: null,
          emailChangeTokenExpiresAt: null,
        },
      });
      if (updated.count === 0) throw invalid;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Este e-mail já está em uso');
      }
      throw error;
    }
    return { email: user.pendingEmail };
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (user && !user.emailVerifiedAt) {
      await this.issueAndSendVerification(user.id, user.name, user.email);
    }
    return { message: GENERIC_RESEND_MESSAGE };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (user) {
      const secret = nanoid(PASSWORD_RESET_SECRET_LENGTH);
      const passwordResetTokenHash = await argon2.hash(secret);
      const ttlHours =
        this.config.get<number>('PASSWORD_RESET_TOKEN_TTL_HOURS') ?? 2;
      const passwordResetTokenExpiresAt = new Date(
        Date.now() + ttlHours * 60 * 60 * 1000,
      );

      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordResetTokenHash, passwordResetTokenExpiresAt },
      });

      const appUrl = this.config.get<string>('APP_URL');
      const resetUrl = `${appUrl}/redefinir-senha?token=${user.id}.${secret}`;
      await this.mail.sendPasswordReset({
        to: user.email,
        name: user.name,
        resetUrl,
        expiresInHours: Number(ttlHours),
      });
    }
    return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const { userId, secret } = this.parseToken(dto.token);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user ||
      !user.passwordResetTokenHash ||
      !user.passwordResetTokenExpiresAt ||
      user.passwordResetTokenExpiresAt < new Date()
    ) {
      throw new UnauthorizedException(
        'Link de redefinição inválido ou expirado',
      );
    }

    const valid = await argon2.verify(user.passwordResetTokenHash, secret);
    if (!valid) {
      throw new UnauthorizedException(
        'Link de redefinição inválido ou expirado',
      );
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: {
          id: user.id,
          passwordResetTokenHash: user.passwordResetTokenHash,
        },
        data: {
          passwordHash,
          passwordResetTokenHash: null,
          passwordResetTokenExpiresAt: null,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          emailVerificationTokenHash: null,
          emailVerificationTokenExpiresAt: null,
        },
      });
      if (updated.count === 0) {
        throw new UnauthorizedException(
          'Link de redefinição inválido ou expirado',
        );
      }

      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { message: 'Senha redefinida. Faça login com sua nova senha.' };
  }

  async refresh(
    refreshToken: string,
    meta: SessionMeta = {},
  ): Promise<AuthTokens> {
    const { sessionId, secret } = this.parseRefreshToken(refreshToken);

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.revokedAt) {
      if (session?.revokedAt) {
        await this.prisma.session.updateMany({
          where: { userId: session.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('Sessão inválida');
    }

    const valid = await argon2.verify(session.refreshTokenHash, secret);
    if (!valid) {
      throw new UnauthorizedException('Sessão inválida');
    }

    const revoked = await this.prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) {
      await this.prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Sessão inválida');
    }

    return this.issueTokens(session.userId, meta);
  }

  async logout(refreshToken: string): Promise<void> {
    const { sessionId } = this.parseRefreshToken(refreshToken);
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async issueTokens(
    userId: string,
    meta: SessionMeta = {},
  ): Promise<AuthTokens> {
    const secret = nanoid(REFRESH_SECRET_LENGTH);
    const refreshTokenHash = await argon2.hash(secret);

    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        deviceLabel: meta.deviceLabel,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    const payload: JwtPayload = { sub: userId, sid: session.id };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<StringValue>('JWT_ACCESS_TTL'),
    });

    return {
      accessToken,
      refreshToken: `${session.id}.${secret}`,
    };
  }

  async issueTokensWithTenants(
    userId: string,
    meta: SessionMeta = {},
  ): Promise<SessionResult> {
    const [tokens, tenants] = await Promise.all([
      this.issueTokens(userId, meta),
      listUserTenants(this.prisma, userId),
    ]);
    return { ...tokens, tenants };
  }

  private async issueAndSendVerification(
    userId: string,
    name: string,
    email: string,
  ): Promise<void> {
    const secret = nanoid(VERIFICATION_SECRET_LENGTH);
    const emailVerificationTokenHash = await argon2.hash(secret);
    const ttlHours =
      this.config.get<number>('EMAIL_VERIFICATION_TOKEN_TTL_HOURS') ?? 24;
    const emailVerificationTokenExpiresAt = new Date(
      Date.now() + ttlHours * 60 * 60 * 1000,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerificationTokenHash, emailVerificationTokenExpiresAt },
    });

    const appUrl = this.config.get<string>('APP_URL');
    const verifyUrl = `${appUrl}/verificar-email?token=${userId}.${secret}`;
    await this.mail.sendEmailVerification({
      to: email,
      name,
      verifyUrl,
      expiresInHours: Number(ttlHours),
    });
  }

  private parseRefreshToken(token: string): {
    sessionId: string;
    secret: string;
  } {
    const separatorIndex = token.indexOf('.');
    if (separatorIndex === -1) {
      throw new UnauthorizedException('Sessão inválida');
    }
    return {
      sessionId: token.slice(0, separatorIndex),
      secret: token.slice(separatorIndex + 1),
    };
  }

  private parseToken(token: string): { userId: string; secret: string } {
    const separatorIndex = token.indexOf('.');
    if (separatorIndex === -1) {
      throw new UnauthorizedException(
        'Link de verificação inválido ou expirado',
      );
    }
    return {
      userId: token.slice(0, separatorIndex),
      secret: token.slice(separatorIndex + 1),
    };
  }
}
