import { SetMetadata } from '@nestjs/common';
import { PermissionLevel, PermissionModule } from './permission.types';

export const PERMISSION_KEY = 'requiredPermission';

export type RequiredPermission = {
  module: PermissionModule;
  level: PermissionLevel;
};

export const RequirePermission = (
  module: PermissionModule,
  level: PermissionLevel,
) =>
  SetMetadata(PERMISSION_KEY, { module, level } satisfies RequiredPermission);
