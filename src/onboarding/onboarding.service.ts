import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Role,
  MembershipStatus,
  SubscriptionStatus,
} from '../../generated/prisma/enums';
import { DEFAULT_PLAN_CODE, TRIAL_DAYS } from '../common/constants/billing';
import { lockTenant } from '../common/plan/plan-limits';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateBranchDto } from './dto/create-branch.dto';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async createCompany(userId: string, dto: CreateCompanyDto) {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    const tenant = await this.prisma.tenant.create({
      data: {
        legalName: dto.legalName,
        tradeName: dto.tradeName,
        cnpj: dto.cnpj,
        trialEndsAt,
        memberships: {
          create: {
            userId,
            role: Role.OWNER,
            status: MembershipStatus.ACTIVE,
          },
        },
        subscription: {
          create: {
            planCode: DEFAULT_PLAN_CODE,
            status: SubscriptionStatus.TRIAL,
          },
        },
      },
    });

    return { tenantId: tenant.id, trialEndsAt: tenant.trialEndsAt };
  }

  async createBranch(tenantId: string, dto: CreateBranchDto) {
    const branch = await this.prisma.$transaction(async (tx) => {
      await lockTenant(tx, tenantId);
      const existingCount = await tx.branch.count({ where: { tenantId } });
      if (existingCount > 0) {
        throw new ConflictException(
          'Esta distribuidora já possui filial. Use o módulo de filiais para criar novas.',
        );
      }

      return tx.branch.create({
        data: {
          tenantId,
          name: dto.name,
          city: dto.city,
          uf: dto.uf,
          isMain: true,
        },
      });
    });

    return { branchId: branch.id };
  }
}
