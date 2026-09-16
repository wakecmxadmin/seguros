import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  type: string;
  permissions: string[];
  roles: string[];
  clientId: string | null;
  partnerId: string | null;
}

export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return field ? req.user?.[field] : req.user;
  },
);
