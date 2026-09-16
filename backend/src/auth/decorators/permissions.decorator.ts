import { SetMetadata } from '@nestjs/common';
import type { PermissionSlug } from '../../common/permissions';

export const PERMISSIONS_KEY = 'permissions';

/** Exige que o usuário tenha **todas** as permissões informadas. */
export const RequirePermissions = (...permissions: PermissionSlug[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
