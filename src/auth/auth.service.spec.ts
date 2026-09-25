import { UnauthorizedException } from '@nestjs/common';

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

jest.mock('nanoid', () => ({ nanoid: jest.fn() }));

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../../generated/prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError {},
  },
}));

jest.mock('../mail/mail.service', () => ({
  MailService: class MailService {},
}));

jest.mock('./google-identity.service', () => ({
  GoogleIdentityService: class GoogleIdentityService {},
}));

jest.mock('../common/membership/list-user-tenants', () => ({
  listUserTenants: jest.fn(),
}));

import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('não vincula automaticamente um e-mail externo já cadastrado', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-id',
          googleSubject: null,
        }),
      },
    };
    const googleIdentity = {
      verify: jest.fn().mockResolvedValue({
        subject: 'google-subject',
        email: 'ana@distribuidora.com',
        name: 'Ana',
        avatarUrl: undefined,
        emailIsAuthoritative: false,
      }),
    };
    const service = new AuthService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      googleIdentity as never,
    );

    const loginWithGoogle = service.loginWithGoogle.bind(
      service,
    ) as unknown as (idToken: string, nonce: string) => Promise<unknown>;

    await expect(
      loginWithGoogle('signed-id-token', 'nonce-value'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
