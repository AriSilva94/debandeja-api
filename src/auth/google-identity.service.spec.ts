import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { GoogleIdentityService } from './google-identity.service';

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(),
}));

type Config = { get: jest.Mock };

describe('GoogleIdentityService', () => {
  const verifyIdToken = jest.fn();
  const config: Config = {
    get: jest.fn(() => 'client-id.apps.googleusercontent.com'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(OAuth2Client)
      .mockImplementation(() => ({ verifyIdToken }) as never);
  });

  it('aceita uma identidade Google com e-mail confirmado', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-subject',
        email: 'ana@distribuidora.com',
        email_verified: true,
        nonce: 'nonce-value',
        name: 'Ana Silva',
        picture: 'https://lh3.googleusercontent.com/avatar',
      }),
    });
    const service = new GoogleIdentityService(config as never);

    await expect(
      service.verify('signed-id-token', 'nonce-value'),
    ).resolves.toEqual({
      subject: 'google-subject',
      email: 'ana@distribuidora.com',
      name: 'Ana Silva',
      avatarUrl: 'https://lh3.googleusercontent.com/avatar',
      emailIsAuthoritative: false,
    });
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'signed-id-token',
      audience: 'client-id.apps.googleusercontent.com',
    });
  });

  it('recusa uma identidade sem e-mail confirmado', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-subject',
        email: 'ana@distribuidora.com',
        email_verified: false,
      }),
    });
    const service = new GoogleIdentityService(config as never);

    await expect(
      service.verify('signed-id-token', 'nonce-value'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa uma identidade cujo nonce não corresponde ao fluxo iniciado', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-subject',
        email: 'ana@gmail.com',
        email_verified: true,
        nonce: 'nonce-de-outro-fluxo',
      }),
    });
    const service = new GoogleIdentityService(config as never);

    await expect(
      service.verify('signed-id-token', 'nonce-value'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('considera Gmail como e-mail autoritativo', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-subject',
        email: 'ana@gmail.com',
        email_verified: true,
        nonce: 'nonce-value',
      }),
    });
    const service = new GoogleIdentityService(config as never);

    await expect(
      service.verify('signed-id-token', 'nonce-value'),
    ).resolves.toMatchObject({
      emailIsAuthoritative: true,
    });
  });
});
