import { Logger, type OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionStatus } from '../../../generated/prisma/enums';
import { lockTenant } from '../../common/plan/plan-limits';
import {
  DATA_RETENTION_DAYS,
  purgeCutoff,
} from '../../common/plan/subscription-status';

export const TENANT_PURGE_QUEUE = 'tenant-purge';

@Processor(TENANT_PURGE_QUEUE)
export class TenantPurgeProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(TenantPurgeProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(TENANT_PURGE_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      'daily-tenant-purge',
      { pattern: '0 3 * * *', tz: 'America/Sao_Paulo' },
      {
        name: 'purge-canceled-tenants',
        opts: { removeOnComplete: true, removeOnFail: 50 },
      },
    );
  }

  async process(): Promise<void> {
    const cutoff = purgeCutoff();
    const expired = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.CANCELED,
        canceledAt: { lte: cutoff },
      },
      select: { tenantId: true },
    });

    let purged = 0;
    for (const { tenantId } of expired) {
      if (await this.purgeTenant(tenantId, cutoff)) purged++;
    }
    if (purged > 0) {
      this.logger.log(
        `${purged} distribuidora(s) cancelada(s) há mais de ${DATA_RETENTION_DAYS} dias excluída(s)`,
      );
    }
  }

  private purgeTenant(tenantId: string, cutoff: Date) {
    return this.prisma.$transaction(async (tx) => {
      await lockTenant(tx, tenantId);
      const stillExpired = await tx.subscription.count({
        where: {
          tenantId,
          status: SubscriptionStatus.CANCELED,
          canceledAt: { lte: cutoff },
        },
      });
      if (stillExpired === 0) return false;

      await tx.movement.deleteMany({ where: { tenantId } });
      await tx.tenant.delete({ where: { id: tenantId } });
      return true;
    });
  }
}
