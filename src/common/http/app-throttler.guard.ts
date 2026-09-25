import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { clientIp } from './client-ip';

const jwt = new JwtService();

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const header = req.headers.authorization;
    const secret = process.env.JWT_SECRET;
    if (header?.startsWith('Bearer ') && secret) {
      try {
        const payload = await jwt.verifyAsync<JwtPayload>(header.slice(7), {
          secret,
        });
        return `user:${payload.sub}`;
      } catch {
        return `ip:${clientIp(req)}`;
      }
    }
    return `ip:${clientIp(req)}`;
  }
}
