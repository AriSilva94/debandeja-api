import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, type SessionResult } from '../auth/auth.service';
import { MembershipStatus } from '../../generated/prisma/enums';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { TeamNotifier } from '../notifications/team-notifier.service';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly teamNotifier: TeamNotifier,
  ) {}

  async accept(
    dto: AcceptInviteDto,
  ): Promise<SessionResult | { status: 'verification_required' }> {
    const { membershipId, secret } = this.parseToken(dto.token);

    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (
      !membership ||
      membership.status !== MembershipStatus.INVITED ||
      !membership.inviteTokenHash ||
      !membership.inviteTokenExpiresAt ||
      membership.inviteTokenExpiresAt < new Date() ||
      !membership.invitedEmail
    ) {
      throw new UnauthorizedException('Convite inválido ou expirado');
    }

    const valid = await argon2.verify(membership.inviteTokenHash, secret);
    if (!valid) {
      throw new UnauthorizedException('Convite inválido ou expirado');
    }

    const invitedEmail = membership.invitedEmail;

    const { userId, readyToLogin } = await this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.membership.updateMany({
          where: {
            id: membership.id,
            status: MembershipStatus.INVITED,
            inviteTokenHash: membership.inviteTokenHash,
          },
          data: {
            status: MembershipStatus.ACTIVE,
            invitedEmail: null,
            inviteTokenHash: null,
            inviteTokenExpiresAt: null,
          },
        });
        if (locked.count === 0) {
          throw new UnauthorizedException('Convite inválido ou expirado');
        }

        let resolvedUserId: string;
        let resolvedReadyToLogin: boolean;
        const existingUser = await tx.user.findUnique({
          where: { email: invitedEmail },
        });

        if (existingUser) {
          resolvedUserId = existingUser.id;
          resolvedReadyToLogin = Boolean(existingUser.emailVerifiedAt);
        } else {
          if (!dto.name || !dto.password) {
            throw new BadRequestException(
              'Nome e senha são obrigatórios para criar sua conta',
            );
          }
          const passwordHash = await argon2.hash(dto.password);
          const user = await tx.user.create({
            data: {
              name: dto.name,
              email: invitedEmail,
              passwordHash,
              emailVerifiedAt: new Date(),
            },
          });
          resolvedUserId = user.id;
          resolvedReadyToLogin = true;
        }

        await tx.membership.update({
          where: { id: membership.id },
          data: { userId: resolvedUserId },
        });

        return { userId: resolvedUserId, readyToLogin: resolvedReadyToLogin };
      },
    );

    await this.teamNotifier.memberJoined(membership.tenantId, userId);

    if (!readyToLogin) {
      return { status: 'verification_required' };
    }

    return this.authService.issueTokensWithTenants(userId);
  }

  private parseToken(token: string): { membershipId: string; secret: string } {
    const separatorIndex = token.indexOf('.');
    if (separatorIndex === -1) {
      throw new UnauthorizedException('Convite inválido ou expirado');
    }
    return {
      membershipId: token.slice(0, separatorIndex),
      secret: token.slice(separatorIndex + 1),
    };
  }
}
