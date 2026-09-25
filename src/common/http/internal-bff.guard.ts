import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { isTrustedBff } from './client-ip';

@Injectable()
export class InternalBffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!isTrustedBff(request)) {
      throw new UnauthorizedException('Requisição não autorizada');
    }
    return true;
  }
}
