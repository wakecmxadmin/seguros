import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT', 587),
        secure: false,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
    } else {
      this.logger.warn('SMTP não configurado — e-mails serão apenas registrados em log.');
    }
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.transporter) {
      this.logger.log(`[e-mail simulado] to=${to} subject="${subject}"\n${html}`);
      return;
    }
    await this.transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM'),
      to,
      subject,
      html,
    });
  }

  private layout(title: string, body: string) {
    return `
<div style="font-family:Inter,Roboto,Helvetica,Arial,sans-serif;background:#f7f8fa;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e6ed;border-radius:12px;overflow:hidden">
    <div style="background:#17348c;padding:20px 28px">
      <span style="color:#fff;font-size:16px;font-weight:600;letter-spacing:.02em">Pinho Seguros</span>
    </div>
    <div style="padding:28px">
      <h1 style="margin:0 0 16px;font-size:18px;color:#1a2233">${title}</h1>
      ${body}
    </div>
    <div style="padding:16px 28px;border-top:1px solid #e2e6ed;color:#5c6779;font-size:12px">
      Se você não solicitou este e-mail, pode ignorá-lo com segurança.
    </div>
  </div>
</div>`;
  }

  private button(url: string, label: string) {
    return `<a href="${url}" style="display:inline-block;background:#009dbe;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${label}</a>`;
  }

  async sendPasswordRecovery(to: string, name: string, token: string) {
    const url = `${this.config.get('APP_URL')}/reset-password?token=${token}`;
    const minutes = this.config.get<number>('PASSWORD_RESET_EXPIRES_MIN', 60);
    await this.send(
      to,
      'Redefinição de senha',
      this.layout(
        'Redefinir sua senha',
        `<p style="color:#5c6779;line-height:1.6">Olá, ${name}. Recebemos um pedido para redefinir a sua senha.
         O link abaixo vale por ${minutes} minutos.</p>
         <p style="margin:24px 0">${this.button(url, 'Definir nova senha')}</p>
         <p style="color:#5c6779;font-size:13px">Ou copie este endereço: <br><span style="color:#17348c">${url}</span></p>`,
      ),
    );
  }

  async sendInvite(to: string, name: string, token: string) {
    const url = `${this.config.get('APP_URL')}/first-access?token=${token}`;
    await this.send(
      to,
      'Seu acesso ao sistema Pinho Seguros',
      this.layout(
        'Bem-vindo(a)',
        `<p style="color:#5c6779;line-height:1.6">Olá, ${name}. Uma conta foi criada para você no sistema
         Pinho Seguros. Defina sua senha para começar.</p>
         <p style="margin:24px 0">${this.button(url, 'Definir minha senha')}</p>
         <p style="color:#5c6779;font-size:13px">Ou copie este endereço: <br><span style="color:#17348c">${url}</span></p>`,
      ),
    );
  }
}
