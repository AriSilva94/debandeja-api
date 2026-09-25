import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request } from 'express';

const MIN_TOKEN_LENGTH = 32;

function isTrustedBff(req: Request): boolean {
  const expected = process.env.INTERNAL_API_TOKEN;
  const received = req.headers['x-internal-token'];
  if (!expected || expected.length < MIN_TOKEN_LENGTH) return false;
  if (typeof received !== 'string' || received.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export function clientIp(req: Request): string {
  if (isTrustedBff(req)) {
    const forwarded = req.headers['x-client-ip'];
    if (typeof forwarded === 'string' && isIP(forwarded.trim())) {
      return forwarded.trim();
    }
  }
  return req.socket.remoteAddress ?? 'unknown';
}
