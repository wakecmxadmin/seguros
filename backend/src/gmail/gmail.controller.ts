import { Controller, Delete, Get, Logger, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { GmailService } from './gmail.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

/**
 * Conexão OAuth do Gmail — cada operador conecta a própria conta para enviar
 * mensagens a partir de um processo (ver módulo `communications`, tarefa 31).
 *
 * O `state` do fluxo OAuth é um JWT de curta duração assinado por nós — não
 * um payload aberto — para que o callback não possa ser usado para associar
 * o Gmail de um atacante à conta de outro usuário (CSRF de login OAuth).
 */
@Controller('gmail')
export class GmailController {
  private readonly logger = new Logger(GmailController.name);

  constructor(
    private gmail: GmailService,
    private config: ConfigService,
    private jwt: JwtService,
  ) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('gmail:connect')
  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.gmail.status(user.id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('gmail:connect')
  @Get('auth-url')
  authUrl(@CurrentUser() user: AuthenticatedUser) {
    const state = this.jwt.sign(
      { userId: user.id },
      { secret: this.config.getOrThrow<string>('JWT_SECRET'), expiresIn: '10m' },
    );
    return { url: this.gmail.buildAuthUrl(state) };
  }

  /** Callback público do Google — não tem o cookie/token de sessão, só o `state` assinado. */
  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const appUrl = this.config.get<string>('APP_URL', '');
    try {
      const { userId } = this.jwt.verify<{ userId: string }>(state, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      if (!code) throw new Error('Código ausente.');
      await this.gmail.connect(userId, code);
      res.redirect(`${appUrl}/gmail/callback?status=success`);
    } catch (error) {
      this.logger.error(`Falha no callback OAuth do Gmail: ${error instanceof Error ? error.message : error}`);
      res.redirect(`${appUrl}/gmail/callback?status=error`);
    }
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('gmail:connect')
  @Delete('disconnect')
  async disconnect(@CurrentUser() user: AuthenticatedUser) {
    await this.gmail.disconnect(user.id);
    return { ok: true };
  }
}
