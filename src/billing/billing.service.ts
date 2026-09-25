import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipStatus } from '../../generated/prisma/enums';
import { TRIAL_DAYS, trialDaysRemaining } from '../common/constants/billing';
import {
  dataPurgeAt,
  isTrialSubscription,
} from '../common/plan/subscription-status';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlans(tenantId: string) {
    const [plans, subscription] = await Promise.all([
      this.prisma.plan.findMany({ orderBy: { price: 'asc' } }),
      this.prisma.subscription.findUnique({ where: { tenantId } }),
    ]);

    const contractedPlan =
      subscription && !isTrialSubscription(subscription.currentPeriodEnd)
        ? subscription.planCode
        : null;
    return plans.map((plan) => ({
      ...plan,
      current: plan.code === contractedPlan,
    }));
  }

  async getSubscription(tenantId: string) {
    const [tenant, subscription, usersCount, branchesCount, productsCount] =
      await Promise.all([
        this.prisma.tenant.findUniqueOrThrow({
          where: { id: tenantId },
          select: { trialEndsAt: true },
        }),
        this.prisma.subscription.findUniqueOrThrow({
          where: { tenantId },
          include: { plan: true },
        }),
        this.prisma.membership.count({
          where: {
            tenantId,
            status: {
              in: [MembershipStatus.ACTIVE, MembershipStatus.INVITED],
            },
          },
        }),
        this.prisma.branch.count({ where: { tenantId, active: true } }),
        this.prisma.product.count({ where: { tenantId, active: true } }),
      ]);

    return {
      status: subscription.status,
      onTrial: isTrialSubscription(subscription.currentPeriodEnd),
      plan: subscription.plan,
      trialEndsAt: tenant.trialEndsAt,
      trialDays: TRIAL_DAYS,
      trialDaysRemaining: trialDaysRemaining(tenant.trialEndsAt),
      currentPeriodEnd: subscription.currentPeriodEnd,
      dataPurgeAt: dataPurgeAt(subscription.canceledAt),
      usage: {
        users: { used: usersCount, limit: subscription.plan.maxUsers },
        branches: { used: branchesCount, limit: subscription.plan.maxBranches },
        products: { used: productsCount, limit: subscription.plan.maxProducts },
      },
    };
  }

  listInvoices(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async getInvoiceDownloadUrl(
    tenantId: string,
    invoiceId: string,
  ): Promise<string> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice || invoice.tenantId !== tenantId) {
      throw new NotFoundException('Fatura não encontrada');
    }
    if (!invoice.pdfUrl) {
      throw new NotFoundException('PDF desta fatura ainda não está disponível');
    }
    return invoice.pdfUrl;
  }
}
