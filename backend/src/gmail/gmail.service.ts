import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const SCOPE = 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email';

export interface OutgoingAttachment {
  fileName: string;
  mimeType: string;
  content: Buffer;
}

export interface SendMailInput {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  attachments?: OutgoingAttachment[];
}

/**
 * Envio de e-mail via API do Gmail, com OAuth por usuário — cada operador
 * conecta a própria conta, como no legado (e-mails saíam da caixa pessoal).
 * Ver `docs/12-reuniao-cliente.md` § 5.
 */
@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  private get clientId() {
    return this.requireConfig('GOOGLE_CLIENT_ID');
  }

  private get clientSecret() {
    return this.requireConfig('GOOGLE_CLIENT_SECRET');
  }

  private get redirectUri() {
    return this.requireConfig('GOOGLE_OAUTH_REDIRECT_URI');
  }

  private requireConfig(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new BadRequestException(
        'Integração com o Gmail não configurada. Defina as credenciais do Google no .env.',
      );
    }
    return value;
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('GOOGLE_CLIENT_ID') &&
        this.config.get<string>('GOOGLE_CLIENT_SECRET') &&
        this.config.get<string>('GOOGLE_OAUTH_REDIRECT_URI'),
    );
  }

  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  /** Troca o code do callback OAuth por tokens e associa ao usuário. */
  async connect(userId: string, code: string) {
    const tokens = await this.exchangeCode(code);
    const email = await this.fetchEmail(tokens.access_token);

    await this.prisma.gmailAccount.upsert({
      where: { userId },
      update: {
        gmailEmail: email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      create: {
        userId,
        gmailEmail: email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? '',
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });
    return { email };
  }

  async status(userId: string) {
    const account = await this.prisma.gmailAccount.findUnique({ where: { userId } });
    return { connected: !!account, email: account?.gmailEmail ?? null };
  }

  async disconnect(userId: string) {
    await this.prisma.gmailAccount.deleteMany({ where: { userId } });
  }

  /** Envia via Gmail em nome do usuário, atualizando o token se necessário. */
  async send(userId: string, input: SendMailInput): Promise<string> {
    const account = await this.prisma.gmailAccount.findUnique({ where: { userId } });
    if (!account) {
      throw new BadRequestException('Conecte sua conta Gmail antes de enviar mensagens.');
    }

    const accessToken = await this.ensureFreshToken(account);
    const raw = this.buildRawMessage(account.gmailEmail, input);

    const response = await fetch(SEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Falha ao enviar via Gmail (${response.status}): ${body}`);
      throw new BadRequestException('Não foi possível enviar o e-mail pelo Gmail.');
    }

    const data = (await response.json()) as { id: string };
    return data.id;
  }

  private async ensureFreshToken(account: { userId: string; accessToken: string; refreshToken: string; expiresAt: Date }) {
    const expiresSoon = account.expiresAt.getTime() - Date.now() < 60_000;
    if (!expiresSoon) return account.accessToken;

    const refreshed = await this.refreshAccessToken(account.refreshToken);
    await this.prisma.gmailAccount.update({
      where: { userId: account.userId },
      data: {
        accessToken: refreshed.access_token,
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    });
    return refreshed.access_token;
  }

  private async exchangeCode(code: string) {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!response.ok) {
      throw new BadRequestException('Falha ao concluir a conexão com o Gmail.');
    }
    return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
  }

  private async refreshAccessToken(refreshToken: string) {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
      }),
    });
    if (!response.ok) {
      throw new BadRequestException('A conexão com o Gmail expirou. Reconecte sua conta.');
    }
    return response.json() as Promise<{ access_token: string; expires_in: number }>;
  }

  private async fetchEmail(accessToken: string) {
    const response = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await response.json()) as { email: string };
    return data.email;
  }

  /** Monta a mensagem RFC 2822/MIME e serializa em base64url para a API do Gmail. */
  private buildRawMessage(from: string, input: SendMailInput): string {
    const boundary = `seguros_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const encodedSubject = `=?UTF-8?B?${Buffer.from(input.subject, 'utf-8').toString('base64')}?=`;

    const headers = [
      `From: ${from}`,
      `To: ${input.to.join(', ')}`,
      ...(input.cc?.length ? [`Cc: ${input.cc.join(', ')}`] : []),
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
    ];

    const htmlPart = [
      `Content-Type: text/html; charset=UTF-8`,
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(input.html, 'utf-8').toString('base64'),
    ].join('\r\n');

    let body: string;
    if (input.attachments?.length) {
      headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      const parts = [
        `--${boundary}`,
        htmlPart,
        ...input.attachments.map((attachment) =>
          [
            `--${boundary}`,
            `Content-Type: ${attachment.mimeType}; name="${attachment.fileName}"`,
            'Content-Transfer-Encoding: base64',
            `Content-Disposition: attachment; filename="${attachment.fileName}"`,
            '',
            attachment.content.toString('base64'),
          ].join('\r\n'),
        ),
        `--${boundary}--`,
      ];
      body = parts.join('\r\n');
    } else {
      headers.push('Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64');
      body = Buffer.from(input.html, 'utf-8').toString('base64');
    }

    const message = `${headers.join('\r\n')}\r\n\r\n${body}`;
    return Buffer.from(message).toString('base64url');
  }
}
