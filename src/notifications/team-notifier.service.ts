import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { MembershipStatus, Role } from '../../generated/prisma/enums';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  withDefaults,
} from '../common/membership/preferences';

const ROLE_LABEL: Record<Role, string> = {
  OWNER: 'Proprietário',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  SALES: 'Vendedor',
  STOCKIST: 'Estoquista',
};

const RECIPIENT_ROLES: Role[] = [Role.OWNER, Role.ADMIN];

@Injectable()
export class TeamNotifier {
  private readonly logger = new Logger(TeamNotifier.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async memberJoined(
    tenantId: string,
    memberUserId: string,
    actorUserId?: string,
  ) {
    const member = await this.prisma.user.findUnique({
      where: { id: memberUserId },
      select: { name: true },
    });
    if (!member) return;
    await this.notify(
      tenantId,
      [memberUserId, actorUserId],
      `${member.name} entrou na equipe`,
    );
  }

  async roleChanged(params: {
    tenantId: string;
    actorUserId: string;
    memberUserId: string;
    memberName: string;
    from: Role;
    to: Role;
  }) {
    await this.notify(
      params.tenantId,
      [params.actorUserId, params.memberUserId],
      `${params.memberName} passou de ${ROLE_LABEL[params.from]} para ${ROLE_LABEL[params.to]}`,
    );
  }

  private async notify(
    tenantId: string,
    excludeUserIds: (string | undefined)[],
    summary: string,
  ) {
    try {
      const recipients = await this.prisma.membership.findMany({
        where: {
          tenantId,
          status: MembershipStatus.ACTIVE,
          role: { in: RECIPIENT_ROLES },
          userId: { notIn: excludeUserIds.filter((id) => id !== undefined) },
        },
        select: {
          user: {
            select: { email: true, name: true, notificationSettings: true },
          },
          tenant: { select: { legalName: true, tradeName: true } },
        },
      });

      const teamUrl = `${this.config.get<string>('APP_URL')}/equipe`;
      for (const { user, tenant } of recipients) {
        if (!user) continue;
        const settings = withDefaults(
          DEFAULT_NOTIFICATION_SETTINGS,
          user.notificationSettings,
        );
        if (!settings.inviteAlerts) continue;
        await this.mail.sendTeamUpdate({
          to: user.email,
          name: user.name,
          tenantName: tenant.tradeName ?? tenant.legalName,
          summary,
          teamUrl,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Aviso de equipe não enviado (${tenantId}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
