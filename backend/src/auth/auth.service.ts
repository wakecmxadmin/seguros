import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PasswordResetType, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
} from './dto/auth.dto';

/** Tentativas antes do bloqueio temporário. */
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const SALT_ROUNDS = 12;

export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
    private mail: MailService,
  ) {}

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------

  async login(dto: LoginDto, ctx: RequestContext) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    // Mensagem genérica: não revelamos se o e-mail existe.
    const invalidCredentials = new UnauthorizedException(
      'E-mail ou senha incorretos.',
    );

    if (!user || !user.password) {
      // Gasta tempo semelhante ao caminho válido, para não vazar existência por timing.
      await bcrypt.compare(dto.password, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
      throw invalidCredentials;
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(
        `Conta temporariamente bloqueada. Tente novamente em ${minutes} minuto(s).`,
      );
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatches) {
      await this.registerFailedAttempt(user);
      throw invalidCredentials;
    }

    if (user.status === 'INVITED') {
      throw new UnauthorizedException(
        'Seu primeiro acesso ainda não foi concluído. Verifique o convite enviado por e-mail.',
      );
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Sua conta está inativa. Procure um administrador.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    await this.audit.record({
      userId: user.id,
      action: 'login',
      entity: 'User',
      entityId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.issueTokens(user, ctx);
  }

  private async registerFailedAttempt(user: User) {
    const attempts = user.failedAttempts + 1;
    const shouldLock = attempts >= MAX_ATTEMPTS;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCK_MINUTES * 60_000)
          : user.lockedUntil,
      },
    });

    if (shouldLock) {
      await this.audit.record({
        userId: user.id,
        action: 'login_locked',
        entity: 'User',
        entityId: user.id,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Tokens
  // -------------------------------------------------------------------------

  private async issueTokens(user: User, ctx: RequestContext) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '15m'),
      },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const days = this.refreshDays();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + days * 86_400_000),
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: await this.profile(user.id),
    };
  }

  async refresh(refreshToken: string, ctx: RequestContext) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(refreshToken) },
      include: { user: true },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }
    if (record.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Sua conta está inativa.');
    }

    // Rotação: o refresh usado é revogado e um novo é emitido.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(record.user, ctx);
  }

  async logout(refreshToken: string | undefined, userId: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: this.hash(refreshToken), userId },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.record({
      userId,
      action: 'logout',
      entity: 'User',
      entityId: userId,
    });
    return { ok: true };
  }

  /** Encerra todas as sessões do usuário. */
  async revokeAllSessions(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Sessões ativas do usuário. `current` marca a que fez esta requisição,
   * para a tela não oferecer o botão de encerrar a própria sessão.
   */
  async listSessions(userId: string, currentRefreshToken?: string) {
    const sessions = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tokenHash: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    const currentHash = currentRefreshToken ? this.hash(currentRefreshToken) : null;

    return sessions.map(({ tokenHash, ...session }) => ({
      ...session,
      current: !!currentHash && tokenHash === currentHash,
    }));
  }

  /** Encerra uma sessão específica. */
  async revokeSession(userId: string, sessionId: string, ctx: RequestContext) {
    const session = await this.prisma.refreshToken.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
    });
    if (!session) throw new NotFoundException('Sessão não encontrada ou já encerrada.');

    await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      userId,
      action: 'session_revoked',
      entity: 'RefreshToken',
      entityId: sessionId,
      ...ctx,
    });

    return { ok: true };
  }

  /** Encerra todas as sessões menos a atual. */
  async revokeOtherSessions(
    userId: string,
    currentRefreshToken: string | undefined,
    ctx: RequestContext,
  ) {
    const currentHash = currentRefreshToken ? this.hash(currentRefreshToken) : null;

    const { count } = await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentHash ? { tokenHash: { not: currentHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      userId,
      action: 'sessions_revoked_others',
      entity: 'User',
      entityId: userId,
      after: { count },
      ...ctx,
    });

    return { ok: true, count };
  }

  // -------------------------------------------------------------------------
  // Perfil
  // -------------------------------------------------------------------------

  async profile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });

    const permissions = new Set<string>();
    for (const ur of user.roles) {
      for (const rp of ur.role.permissions) permissions.add(rp.permission.slug);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      document: user.document,
      type: user.type,
      status: user.status,
      jobTitle: user.jobTitle,
      department: user.department,
      clientId: user.clientId,
      partnerId: user.partnerId,
      lastLoginAt: user.lastLoginAt,
      roles: user.roles.map((r) => ({ slug: r.role.slug, name: r.role.name })),
      permissions: [...permissions],
    };
  }

  // -------------------------------------------------------------------------
  // Recuperação de senha
  // -------------------------------------------------------------------------

  /**
   * Sempre responde sucesso, exista ou não o e-mail — não revelamos quais
   * endereços estão cadastrados.
   */
  async forgotPassword(dto: ForgotPasswordDto, ctx: RequestContext) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (user && user.status !== 'INACTIVE') {
      const token = await this.createPasswordToken(
        user.id,
        PasswordResetType.RECOVERY,
        ctx,
      );
      await this.mail.sendPasswordRecovery(user.email, user.name, token);
      await this.audit.record({
        userId: user.id,
        action: 'password_recovery_requested',
        entity: 'User',
        entityId: user.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    }

    return {
      ok: true,
      message:
        'Se houver uma conta com este e-mail, enviaremos as instruções de redefinição.',
    };
  }

  /** Cria (e invalida os anteriores) um token de definição de senha. */
  async createPasswordToken(
    userId: string,
    type: PasswordResetType,
    ctx: RequestContext = {},
  ) {
    await this.prisma.passwordReset.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString('base64url');
    const minutes =
      type === PasswordResetType.FIRST_ACCESS
        ? 60 * 24 * 7 // convite vale uma semana
        : this.config.get<number>('PASSWORD_RESET_EXPIRES_MIN', 60);

    await this.prisma.passwordReset.create({
      data: {
        userId,
        tokenHash: this.hash(token),
        type,
        expiresAt: new Date(Date.now() + minutes * 60_000),
        ip: ctx.ip ?? null,
      },
    });

    return token;
  }

  /** Valida um token sem consumi-lo — usado para a tela decidir o que exibir. */
  async validatePasswordToken(token: string) {
    const record = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException(
        'Este link é inválido ou expirou. Solicite um novo.',
      );
    }

    return {
      valid: true,
      type: record.type,
      name: record.user.name,
      email: record.user.email,
    };
  }

  async resetPassword(dto: ResetPasswordDto, ctx: RequestContext) {
    const record = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: this.hash(dto.token) },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException(
        'Este link é inválido ou expirou. Solicite um novo.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          password: await bcrypt.hash(dto.password, SALT_ROUNDS),
          status: 'ACTIVE',
          failedAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordReset.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Trocar a senha derruba todas as sessões ativas.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.record({
      userId: record.userId,
      action:
        record.type === PasswordResetType.FIRST_ACCESS
          ? 'password_set_first_access'
          : 'password_reset',
      entity: 'User',
      entityId: record.userId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ok: true, message: 'Senha definida com sucesso.' };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    ctx: RequestContext,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (
      !user.password ||
      !(await bcrypt.compare(dto.currentPassword, user.password))
    ) {
      throw new BadRequestException('A senha atual está incorreta.');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('A nova senha deve ser diferente da atual.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: await bcrypt.hash(dto.newPassword, SALT_ROUNDS) },
    });
    await this.revokeAllSessions(userId);

    await this.audit.record({
      userId,
      action: 'password_changed',
      entity: 'User',
      entityId: userId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ok: true, message: 'Senha alterada. Entre novamente.' };
  }

  // -------------------------------------------------------------------------

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private refreshDays() {
    const raw = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 7;
  }
}
