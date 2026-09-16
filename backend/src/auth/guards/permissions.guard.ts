import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user: AuthenticatedUser = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException('Usuário não autenticado.');

    const missing = required.filter((p) => !user.permissions.includes(p));
    if (missing.length) {
      throw new ForbiddenException(
        `Você não tem permissão para esta ação (${missing.join(', ')}).`,
      );
    }
    return true;
  }
}
