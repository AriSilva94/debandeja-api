import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipStatus, Role } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';
import { assertPlanAllows, lockTenant } from '../common/plan/plan-limits';
import { assertBranchesBelongToTenant } from '../common/tenant/resolve-branch-scope';
import { MailService } from '../mail/mail.service';
import { TeamNotifier } from '../notifications/team-notifier.service';
import { PERMISSION_MATRIX } from '../common/permissions/permission-matrix';
import { InviteMemberDto } from './dto/invite-member.dto';
import type { TenantContext } from '../common/tenant/tenant-context';
import { UpdateMemberDto } from './dto/update-member.dto';

const INVITE_SECRET_LENGTH = 32;

const MEMBER_INCLUDE = {
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
  branches: { include: { branch: { select: { id: true, name: true } } } },
} as const;

type MemberRow = Prisma.MembershipGetPayload<{
  include: typeof MEMBER_INCLUDE;
}>;

function toMember(m: MemberRow) {
  return {
    id: m.id,
    role: m.role,
    status: m.status,
    lastAccessAt: m.lastAccessAt,
    name: m.user?.name ?? null,
    email: m.user?.email ?? m.invitedEmail,
    avatarUrl: m.user?.avatarUrl ?? null,
    branches: m.branches.map((b) => b.branch),
    inviteExpired:
      m.status === MembershipStatus.INVITED &&
      !!m.inviteTokenExpiresAt &&
      m.inviteTokenExpiresAt < new Date(),
  };
}

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly teamNotifier: TeamNotifier,
  ) {}

  async list(tenantId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { tenantId, status: { not: MembershipStatus.REMOVED } },
      include: MEMBER_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map(toMember);
  }

  rolesMatrix() {
    return PERMISSION_MATRIX;
  }

  async invite(tenantId: string, inviterUserId: string, dto: InviteMemberDto) {
    const branchIds = dto.role === Role.ADMIN ? [] : (dto.branchIds ?? []);
    await assertBranchesBelongToTenant(this.prisma, tenantId, branchIds);

    const [user, tenant, inviter] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email } }),
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: inviterUserId } }),
    ]);

    const secret = user ? null : nanoid(INVITE_SECRET_LENGTH);
    const inviteTokenHash = secret ? await argon2.hash(secret) : null;
    const branches = {
      create: branchIds.map((branchId) => ({ branchId })),
    };

    const membership = await this.prisma.$transaction(async (tx) => {
      await lockTenant(tx, tenantId);

      const existing = await tx.membership.findFirst({
        where: {
          tenantId,
          status: { not: MembershipStatus.REMOVED },
          OR: [{ user: { email: dto.email } }, { invitedEmail: dto.email }],
        },
      });
      if (existing) {
        throw new ConflictException('Este e-mail já faz parte da equipe');
      }

      const seats = await tx.membership.count({
        where: {
          tenantId,
          status: { in: [MembershipStatus.ACTIVE, MembershipStatus.INVITED] },
        },
      });
      await assertPlanAllows(tx, tenantId, 'maxUsers', seats);

      if (user) {
        const removed = await tx.membership.findUnique({
          where: { tenantId_userId: { tenantId, userId: user.id } },
        });
        if (removed) {
          await tx.membershipBranch.deleteMany({
            where: { membershipId: removed.id },
          });
          return tx.membership.update({
            where: { id: removed.id },
            data: { role: dto.role, status: MembershipStatus.ACTIVE, branches },
            include: MEMBER_INCLUDE,
          });
        }
        return tx.membership.create({
          data: {
            tenantId,
            role: dto.role,
            userId: user.id,
            status: MembershipStatus.ACTIVE,
            branches,
          },
          include: MEMBER_INCLUDE,
        });
      }

      return tx.membership.create({
        data: {
          tenantId,
          role: dto.role,
          invitedEmail: dto.email,
          status: MembershipStatus.INVITED,
          inviteTokenHash,
          inviteTokenExpiresAt: this.inviteExpiry(),
          branches,
        },
        include: MEMBER_INCLUDE,
      });
    });

    if (secret) {
      await this.sendInviteEmail(
        dto.email,
        membership.id,
        secret,
        tenant,
        inviter.name,
      );
    } else if (membership.userId) {
      await this.teamNotifier.memberJoined(
        tenantId,
        membership.userId,
        inviterUserId,
      );
    }

    return toMember(membership);
  }

  async resendInvite(
    tenantId: string,
    inviterUserId: string,
    membershipId: string,
  ) {
    const membership = await this.findActiveOrInvited(tenantId, membershipId);
    if (
      membership.status !== MembershipStatus.INVITED ||
      !membership.invitedEmail
    ) {
      throw new BadRequestException('Este membro não tem convite pendente');
    }

    const [tenant, inviter] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: inviterUserId } }),
    ]);

    const secret = nanoid(INVITE_SECRET_LENGTH);
    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: {
        inviteTokenHash: await argon2.hash(secret),
        inviteTokenExpiresAt: this.inviteExpiry(),
      },
      include: MEMBER_INCLUDE,
    });

    await this.sendInviteEmail(
      membership.invitedEmail,
      membershipId,
      secret,
      tenant,
      inviter.name,
    );
    return toMember(updated);
  }

  private inviteExpiry() {
    const ttlHours = this.config.get<number>('INVITE_TOKEN_TTL_HOURS') ?? 48;
    return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  }

  private sendInviteEmail(
    to: string,
    membershipId: string,
    secret: string,
    tenant: { tradeName: string | null; legalName: string },
    inviterName: string,
  ) {
    const appUrl = this.config.get<string>('APP_URL');
    return this.mail.sendInvite({
      to,
      tenantName: tenant.tradeName ?? tenant.legalName,
      inviterName,
      acceptUrl: `${appUrl}/aceitar-convite?token=${membershipId}.${secret}`,
    });
  }

  async update(
    actor: TenantContext,
    membershipId: string,
    dto: UpdateMemberDto,
  ) {
    const { tenantId } = actor;
    const membership = await this.findActiveOrInvited(tenantId, membershipId);
    this.assertCanManage(actor, membership);

    const nextRole = dto.role ?? membership.role;
    const nextBranchIds =
      nextRole === Role.ADMIN
        ? []
        : (dto.branchIds ??
          (
            await this.prisma.membershipBranch.findMany({
              where: { membershipId },
              select: { branchId: true },
            })
          ).map((b) => b.branchId));
    if (nextRole !== Role.ADMIN && nextBranchIds.length === 0) {
      throw new BadRequestException('Selecione ao menos uma filial');
    }
    await assertBranchesBelongToTenant(this.prisma, tenantId, nextBranchIds);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.membershipBranch.deleteMany({ where: { membershipId } });
      await tx.membershipBranch.createMany({
        data: nextBranchIds.map((branchId) => ({ membershipId, branchId })),
      });

      return tx.membership.update({
        where: { id: membershipId },
        data: { role: dto.role },
        include: MEMBER_INCLUDE,
      });
    });

    if (
      membership.status === MembershipStatus.ACTIVE &&
      membership.userId &&
      updated.role !== membership.role
    ) {
      await this.teamNotifier.roleChanged({
        tenantId,
        actorUserId: actor.userId,
        memberUserId: membership.userId,
        memberName: updated.user?.name ?? '',
        from: membership.role,
        to: updated.role,
      });
    }
    return toMember(updated);
  }

  async remove(actor: TenantContext, membershipId: string) {
    const membership = await this.findActiveOrInvited(
      actor.tenantId,
      membershipId,
    );
    this.assertCanManage(actor, membership);

    await this.prisma.membership.update({
      where: { id: membershipId },
      data: { status: MembershipStatus.REMOVED },
    });
  }

  private assertCanManage(
    actor: TenantContext,
    membership: { id: string; role: Role },
  ) {
    if (membership.role === Role.OWNER) {
      throw new ForbiddenException(
        'O proprietário não pode ser alterado ou removido',
      );
    }
    if (membership.id === actor.membershipId) {
      throw new ForbiddenException(
        'Você não pode alterar ou remover o seu próprio acesso',
      );
    }
  }

  private async findActiveOrInvited(tenantId: string, membershipId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });
    if (
      !membership ||
      membership.tenantId !== tenantId ||
      membership.status === MembershipStatus.REMOVED
    ) {
      throw new NotFoundException('Membro não encontrado');
    }
    return membership;
  }
}
