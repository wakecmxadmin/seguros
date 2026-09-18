import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { join } from 'path';

const LOGO_CID = 'coomex-logo';
const LOGO_PATH = join(__dirname, 'assets', 'logo.jpeg');

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
      attachments: [
        {
          filename: 'logo.jpeg',
          path: LOGO_PATH,
          cid: LOGO_CID,
        },
      ],
    });
  }

  private layout(title: string, body: string) {
    const year = new Date().getFullYear();
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F4F9;padding:40px 16px;font-family:Inter,Roboto,Helvetica,Arial,sans-serif">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E2E6ED;border-radius:12px;overflow:hidden">
        <tr>
          <td style="padding:32px 32px 24px;text-align:center">
            <img src="cid:${LOGO_CID}" alt="Coomex" width="140" style="display:block;margin:0 auto;height:auto;border:0" />
          </td>
        </tr>
        <tr>
          <td style="height:4px;background:#17348C;font-size:0;line-height:0">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:36px 32px 8px">
            <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#1A2233;font-weight:700">${title}</h1>
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px;color:#5C6779;font-size:13px;line-height:1.6;border-top:1px solid #E2E6ED;margin-top:8px">
            Se você não solicitou este e-mail, pode ignorá-lo com segurança.
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#F7F8FA;text-align:center;color:#5C6779;font-size:12px">
            © ${year} Coomex · Pinho Seguros
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  private button(url: string, label: string) {
    return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#009DBE">
      <a href="${url}" style="display:inline-block;padding:12px 24px;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:14px;border-radius:8px">${label}</a>
    </td></tr></table>`;
  }

  private linkBox(url: string) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">
      <tr>
        <td style="background:#F1F4F9;border:1px solid #E2E6ED;border-radius:8px;padding:12px 16px;color:#17348C;font-size:12px;word-break:break-all;font-family:monospace">${url}</td>
      </tr>
    </table>`;
  }

  async sendPasswordRecovery(to: string, name: string, token: string) {
    const url = `${this.config.get('APP_URL')}/reset-password?token=${token}`;
    const minutes = this.config.get<number>('PASSWORD_RESET_EXPIRES_MIN', 60);
    await this.send(
      to,
      'Redefinição de senha',
      this.layout(
        'Redefinir sua senha',
        `<p style="margin:0 0 24px;color:#5C6779;font-size:14px;line-height:1.6">Olá, ${name}. Recebemos um pedido para redefinir a sua senha.
         O link abaixo vale por ${minutes} minutos.</p>
         ${this.button(url, 'Definir nova senha')}
         <p style="margin:24px 0 4px;color:#5C6779;font-size:13px">Ou copie e cole este endereço no navegador:</p>
         ${this.linkBox(url)}`,
      ),
    );
  }

  async sendInvite(to: string, name: string, token: string) {
    const url = `${this.config.get('APP_URL')}/first-access?token=${token}`;
    await this.send(
      to,
      'Seu acesso ao sistema Pinho Seguros',
      this.layout(
        'Bem-vindo(a) à Pinho Seguros',
        `<p style="margin:0 0 24px;color:#5C6779;font-size:14px;line-height:1.6">Olá, ${name}. Uma conta foi criada para você no sistema
         Pinho Seguros. Defina sua senha para começar.</p>
         ${this.button(url, 'Definir minha senha')}
         <p style="margin:24px 0 4px;color:#5C6779;font-size:13px">Ou copie e cole este endereço no navegador:</p>
         ${this.linkBox(url)}`,
      ),
    );
  }
}
