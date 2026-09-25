import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { TenantContext } from '../tenant/tenant-context';
import { PERMISSION_MATRIX } from './permission-matrix';
import { PermissionLevel } from './permission.types';
import {
  PERMISSION_KEY,
  type RequiredPermission,
} from './require-permission.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      RequiredPermission | undefined
    >(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!required) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ tenant?: TenantContext }>();
    const tenant = request.tenant;
    if (!tenant) {
      throw new ForbiddenException('Contexto de distribuidora ausente');
    }

    const grantedLevel = PERMISSION_MATRIX[tenant.role][required.module];
    if (grantedLevel < required.level) {
      throw new ForbiddenException('Permissão insuficiente para esta ação');
    }
    if (tenant.readOnly && required.level > PermissionLevel.READ) {
      throw new ForbiddenException(
        'Assinatura inativa: a conta está em modo somente leitura até a regularização.',
      );
    }

    return true;
  }
}
