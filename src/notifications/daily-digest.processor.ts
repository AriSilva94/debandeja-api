import { Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { StockService } from '../stock/stock.service';
import type { DailyDigestJobData } from '../mail/mail-job.type';
import {
  MembershipStatus,
  MovementType,
  Role,
} from '../../generated/prisma/enums';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_PREFERENCES,
  withDefaults,
} from '../common/membership/preferences';
import {
  effectiveSubscriptionStatus,
  isReadOnlyStatus,
} from '../common/plan/subscription-status';
import { previousDayWindow } from './digest-window';

export const DAILY_DIGEST_QUEUE = 'daily-digest';
const MAX_ALERTS_LISTED = 10;
const FULL_ACCESS_ROLES: Role[] = [Role.OWNER, Role.ADMIN];

type Alert = Awaited<ReturnType<StockService['alerts']>>[number];
type BranchMovements = {
  branchId: string;
  type: MovementType;
  count: number;
  units: number;
};

@Processor(DAILY_DIGEST_QUEUE)
export class DailyDigestProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(DailyDigestProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly stockService: StockService,
    @InjectQueue(DAILY_DIGEST_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      'daily-digest-8am',
      { pattern: '0 8 * * *', tz: 'America/Sao_Paulo' },
      {
        name: 'send-daily-digest',
        opts: { removeOnComplete: true, removeOnFail: 50 },
      },
    );
  }

  async process(): Promise<void> {
    const window = previousDayWindow();
    const tenants = await this.prisma.tenant.findMany({
      select: {
        id: true,
        legalName: true,
        tradeName: true,
        trialEndsAt: true,
        subscription: { select: { status: true, currentPeriodEnd: true } },
      },
    });

    let sent = 0;
    for (const tenant of tenants) {
      const status =
        tenant.subscription &&
        effectiveSubscriptionStatus({
          ...tenant.subscription,
          trialEndsAt: tenant.trialEndsAt,
        });
      if (!status || isReadOnlyStatus(status)) continue;
      sent += await this.digestTenant(
        tenant.id,
        tenant.tradeName ?? tenant.legalName,
        window,
      );
    }
    this.logger.log(
      `Resumo de ${window.label}: ${sent} e-mail(s) enfileirado(s)`,
    );
  }

  private async digestTenant(
    tenantId: string,
    tenantName: string,
    window: ReturnType<typeof previousDayWindow>,
  ) {
    const members = await this.prisma.membership.findMany({
      where: { tenantId, status: MembershipStatus.ACTIVE },
      select: {
        id: true,
        role: true,
        preferences: true,
        branches: { select: { branchId: true } },
        user: {
          select: { email: true, name: true, notificationSettings: true },
        },
      },
    });
    const recipients = members.flatMap((member) => {
      if (!member.user) return [];
      const wantsSummary = withDefaults(
        DEFAULT_NOTIFICATION_SETTINGS,
        member.user.notificationSettings,
      ).dailySummary;
      const wantsAlerts = withDefaults(
        DEFAULT_PREFERENCES,
        member.preferences,
      ).lowStockEmailAlert;
      if (!wantsSummary && !wantsAlerts) return [];
      const branchIds = FULL_ACCESS_ROLES.includes(member.role)
        ? null
        : member.branches.map((b) => b.branchId);
      return [{ ...member, user: member.user, wantsSummary, branchIds }];
    });
    if (recipients.length === 0) return 0;

    const [alerts, movements] = await Promise.all([
      this.stockService.alerts(tenantId),
      this.movementsByBranch(tenantId, window.start, window.end),
    ]);

    const stockUrl = `${this.config.get<string>('APP_URL')}/estoque`;
    let sent = 0;
    for (const recipient of recipients) {
      const inScope = (branchId: string) =>
        recipient.branchIds === null || recipient.branchIds.includes(branchId);
      const scopedAlerts = alerts.filter((a) => inScope(a.branch.id));
      const scopedMovements = movements.filter((m) => inScope(m.branchId));
      const hasMovements = recipient.wantsSummary && scopedMovements.length > 0;
      if (!hasMovements && scopedAlerts.length === 0) continue;

      await this.mail.sendDailyDigest(
        {
          to: recipient.user.email,
          name: recipient.user.name,
          tenantName,
          day: window.label,
          movements: recipient.wantsSummary
            ? totalsByType(scopedMovements)
            : undefined,
          alerts: scopedAlerts.slice(0, MAX_ALERTS_LISTED).map(toDigestAlert),
          alertsTotal: scopedAlerts.length,
          stockUrl,
        },
        `daily-digest_${window.key}_${recipient.id}`,
      );
      sent++;
    }
    return sent;
  }

  private async movementsByBranch(
    tenantId: string,
    start: Date,
    end: Date,
  ): Promise<BranchMovements[]> {
    const rows = await this.prisma.movement.groupBy({
      by: ['branchId', 'type'],
      where: { tenantId, createdAt: { gte: start, lt: end } },
      _count: { _all: true },
      _sum: { qty: true },
    });
    return rows.map((row) => ({
      branchId: row.branchId,
      type: row.type,
      count: row._count._all,
      units: row._sum.qty ?? 0,
    }));
  }
}

function totalsByType(
  movements: BranchMovements[],
): NonNullable<DailyDigestJobData['movements']> {
  const sum = (type: MovementType) =>
    movements
      .filter((m) => m.type === type)
      .reduce(
        (total, m) => ({
          count: total.count + m.count,
          units: total.units + m.units,
        }),
        { count: 0, units: 0 },
      );
  const exits = sum(MovementType.SAIDA);
  return {
    entries: sum(MovementType.ENTRADA),
    exits: { ...exits, units: -exits.units },
    adjustments: sum(MovementType.AJUSTE),
  };
}

function toDigestAlert(alert: Alert): DailyDigestJobData['alerts'][number] {
  return {
    product: alert.product.name,
    branch: alert.branch.name,
    current: alert.current,
    min: alert.min,
    out: alert.level === 'out',
  };
}
