import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string }): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const permissions = new Set<string>();
    for (const ur of user.roles) {
      for (const rp of ur.role.permissions) permissions.add(rp.permission.slug);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      type: user.type,
      roles: user.roles.map((r) => r.role.slug),
      permissions: [...permissions],
      clientId: user.clientId,
      partnerId: user.partnerId,
    };
  }
}
