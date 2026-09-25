import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export type GoogleIdentity = {
  subject: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emailIsAuthoritative: boolean;
};

@Injectable()
export class GoogleIdentityService {
  private readonly clientId: string;
  private readonly client: OAuth2Client;

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID')!;
    this.client = new OAuth2Client(this.clientId);
  }

  async verify(
    idToken: string,
    expectedNonce: string,
  ): Promise<GoogleIdentity> {
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    if (
      !payload?.sub ||
      !payload.email ||
      payload.email_verified !== true ||
      payload.nonce !== expectedNonce
    ) {
      throw new UnauthorizedException(
        'Não foi possível confirmar sua conta Google',
      );
    }

    return {
      subject: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name?.trim() || payload.email.split('@')[0],
      avatarUrl: payload.picture,
      emailIsAuthoritative:
        payload.email.toLowerCase().endsWith('@gmail.com') ||
        (typeof payload.hd === 'string' && payload.hd.length > 0),
    };
  }
}
