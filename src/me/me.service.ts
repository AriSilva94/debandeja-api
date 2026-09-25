import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_PREFERENCES,
  withDefaults,
} from '../common/membership/preferences';
import { listUserTenants } from '../common/membership/list-user-tenants';
import { PERMISSION_MATRIX } from '../common/permissions/permission-matrix';
import { TRIAL_DAYS, trialDaysRemaining } from '../common/constants/billing';
import type { TenantContext } from '../common/tenant/tenant-context';
import {
  PermissionLevel,
  PermissionModule,
} from '../common/permissions/permission.types';
import {
  dataPurgeAt,
  isTrialSubscription,
} from '../common/plan/subscription-status';

import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { RequestEmailChangeDto } from './dto/request-email-change.dto';

const EMAIL_CHANGE_SECRET_LENGTH = 32;

function omitUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

function cappedToRead(permissions: Record<PermissionModule, PermissionLevel>) {
  const capped = { ...permissions };
  for (const module of Object.values(PermissionModule)) {
    capped[module] = Math.min(capped[module], PermissionLevel.READ);
  }
  return capped;
}

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async getProfile(userId: string) {
    const { notificationSettings, ...user } =
      await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          pendingEmail: true,
          avatarUrl: true,
          notificationSettings: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      });
    return {
      ...user,
      notificationSettings: withDefaults(
        DEFAULT_NOTIFICATION_SETTINGS,
        notificationSettings,
      ),
    };
  }

  async getContext(tenant: TenantContext) {
    const [company, subscription, membership] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({
        where: { id: tenant.tenantId },
        select: {
          id: true,
          legalName: true,
          tradeName: true,
          trialEndsAt: true,
        },
      }),
      this.prisma.subscription.findUnique({
        where: { tenantId: tenant.tenantId },
        select: {
          status: true,
          currentPeriodEnd: true,
          canceledAt: true,
          plan: {
            select: {
              code: true,
              name: true,
              maxUsers: true,
              maxBranches: true,
              maxProducts: true,
            },
          },
        },
      }),
      this.prisma.membership.findUniqueOrThrow({
        where: { id: tenant.membershipId },
        select: { preferences: true },
      }),
    ]);

    return {
      tenant: { id: company.id, name: company.tradeName ?? company.legalName },
      role: tenant.role,
      allowedBranchIds: tenant.allowedBranchIds,
      preferences: withDefaults(DEFAULT_PREFERENCES, membership.preferences),
      permissions: tenant.readOnly
        ? cappedToRead(PERMISSION_MATRIX[tenant.role])
        : PERMISSION_MATRIX[tenant.role],
      subscription: subscription && {
        status: subscription.status,
        readOnly: tenant.readOnly,
        onTrial: isTrialSubscription(subscription.currentPeriodEnd),
        dataPurgeAt: dataPurgeAt(subscription.canceledAt),
        planCode: subscription.plan.code,
        planName: subscription.plan.name,
        limits: {
          users: subscription.plan.maxUsers,
          branches: subscription.plan.maxBranches,
          products: subscription.plan.maxProducts,
        },
        trialDays: TRIAL_DAYS,
        trialDaysRemaining: trialDaysRemaining(company.trialEndsAt),
      },
    };
  }

  listTenants(userId: string) {
    return listUserTenants(this.prisma, userId);
  }

  update(userId: string, dto: UpdateMeDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, avatarUrl: dto.avatarUrl },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new BadRequestException('Senha atual incorreta');
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  listSessions(userId: string, currentSessionId: string) {
    return this.prisma.session
      .findMany({
        where: { userId, revokedAt: null },
        orderBy: { lastAccessAt: 'desc' },
      })
      .then((sessions) =>
        sessions.map((s) => ({
          id: s.id,
          deviceLabel: s.deviceLabel,
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          lastAccessAt: s.lastAccessAt,
          createdAt: s.createdAt,
          isCurrent: s.id === currentSessionId,
        })),
      );
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Sessão não encontrada');
    }
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, id: { not: currentSessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async updateNotificationSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { notificationSettings: true },
    });
    const merged = {
      ...withDefaults(DEFAULT_NOTIFICATION_SETTINGS, user.notificationSettings),
      ...omitUndefined(dto),
    };
    await this.prisma.user.update({
      where: { id: userId },
      data: { notificationSettings: merged },
    });
    return merged;
  }

  async updatePreferences(tenant: TenantContext, dto: UpdatePreferencesDto) {
    if (dto.defaultBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: dto.defaultBranchId,
          tenantId: tenant.tenantId,
          active: true,
        },
        select: { id: true },
      });
      const inScope =
        tenant.allowedBranchIds === null ||
        tenant.allowedBranchIds.includes(dto.defaultBranchId);
      if (!branch || !inScope) {
        throw new BadRequestException(
          'Escolha uma filial ativa à qual você tenha acesso',
        );
      }
    }

    const membership = await this.prisma.membership.findUniqueOrThrow({
      where: { id: tenant.membershipId },
      select: { preferences: true },
    });
    const merged = {
      ...withDefaults(DEFAULT_PREFERENCES, membership.preferences),
      ...omitUndefined(dto),
    };
    await this.prisma.membership.update({
      where: { id: tenant.membershipId },
      data: { preferences: merged },
    });
    return merged;
  }

  async requestEmailChange(userId: string, dto: RequestEmailChangeDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new BadRequestException('Senha atual incorreta');
    }
    if (dto.newEmail === user.email) {
      throw new BadRequestException('Este já é o seu e-mail de acesso');
    }
    const taken = await this.prisma.user.findUnique({
      where: { email: dto.newEmail },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException('Este e-mail já está em uso');
    }

    const secret = nanoid(EMAIL_CHANGE_SECRET_LENGTH);
    const ttlHours =
      this.config.get<number>('EMAIL_VERIFICATION_TOKEN_TTL_HOURS') ?? 24;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        pendingEmail: dto.newEmail,
        emailChangeTokenHash: await argon2.hash(secret),
        emailChangeTokenExpiresAt: new Date(
          Date.now() + ttlHours * 60 * 60 * 1000,
        ),
      },
    });

    const appUrl = this.config.get<string>('APP_URL');
    await this.mail.sendEmailChange({
      to: dto.newEmail,
      name: user.name,
      confirmUrl: `${appUrl}/confirmar-email?token=${userId}.${secret}`,
    });
    return { pendingEmail: dto.newEmail };
  }

  async cancelEmailChange(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        pendingEmail: null,
        emailChangeTokenHash: null,
        emailChangeTokenExpiresAt: null,
      },
    });
  }
}
