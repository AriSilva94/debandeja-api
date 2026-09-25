import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type {
  DailyDigestJobData,
  EmailChangeJobData,
  EmailVerificationJobData,
  InviteJobData,
  PasswordResetJobData,
  TeamUpdateJobData,
} from './mail-job.type';
import { smtpOptions } from './smtp-options';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function h(value: string | number) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

const MOVEMENT_LABELS = [
  ['entries', 'Entradas'],
  ['exits', 'Saídas'],
  ['adjustments', 'Ajustes'],
] as const;

@Injectable()
export class MailSenderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MailSenderService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>('MAIL_FROM')!;
    this.transporter = createTransport(
      smtpOptions({
        SMTP_HOST: this.config.get<string>('SMTP_HOST'),
        SMTP_PORT: this.config.get<string>('SMTP_PORT'),
        SMTP_SECURE: this.config.get<string>('SMTP_SECURE'),
        SMTP_USER: this.config.get<string>('SMTP_USER'),
        SMTP_PASS: this.config.get<string>('SMTP_PASS'),
      }),
    );
  }

  async onApplicationBootstrap() {
    try {
      await this.transporter.verify();
      this.logger.log('Conexão SMTP verificada');
    } catch (error) {
      this.logger.error(
        `Falha ao conectar no SMTP: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async sendInvite(params: InviteJobData): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: `${params.inviterName} convidou você para ${params.tenantName} no Debandeja`,
      text: `Você foi convidado para participar de ${params.tenantName} no Debandeja.\n\nAceite o convite: ${params.acceptUrl}\n\nEste link expira em breve.`,
      html: `<p><strong>${h(params.inviterName)}</strong> convidou você para participar de <strong>${h(params.tenantName)}</strong> no Debandeja.</p><p><a href="${params.acceptUrl}">Aceitar convite</a></p><p>Este link expira em breve.</p>`,
    });
    this.logger.log(`Convite enviado para ${params.to}`);
  }

  async sendEmailVerification(params: EmailVerificationJobData): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: 'Confirme seu e-mail no Debandeja',
      text: `Olá, ${params.name}!\n\nConfirme seu e-mail para ativar sua conta no Debandeja: ${params.verifyUrl}\n\nEste link expira em breve.`,
      html: `<p>Olá, ${h(params.name)}!</p><p>Confirme seu e-mail para ativar sua conta no Debandeja.</p><p><a href="${params.verifyUrl}">Confirmar e-mail</a></p><p>Este link expira em breve.</p>`,
    });
    this.logger.log(`E-mail de verificação enviado para ${params.to}`);
  }

  async sendPasswordReset(params: PasswordResetJobData): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: 'Redefinir senha no Debandeja',
      text: `Olá, ${params.name}!\n\nRecebemos um pedido para redefinir sua senha. Se foi você: ${params.resetUrl}\n\nSe não foi você, ignore este e-mail. Este link expira em breve.`,
      html: `<p>Olá, ${h(params.name)}!</p><p>Recebemos um pedido para redefinir sua senha.</p><p><a href="${params.resetUrl}">Redefinir senha</a></p><p>Se não foi você, ignore este e-mail. Este link expira em breve.</p>`,
    });
    this.logger.log(`E-mail de redefinição de senha enviado para ${params.to}`);
  }

  async sendEmailChange(params: EmailChangeJobData): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: 'Confirme seu novo e-mail no Debandeja',
      text: `Olá, ${params.name}!\n\nConfirme este endereço para passar a usá-lo no login do Debandeja: ${params.confirmUrl}\n\nSe não foi você, ignore este e-mail: seu e-mail atual continua valendo. Este link expira em breve.`,
      html: `<p>Olá, ${h(params.name)}!</p><p>Confirme este endereço para passar a usá-lo no login do Debandeja.</p><p><a href="${params.confirmUrl}">Confirmar novo e-mail</a></p><p>Se não foi você, ignore este e-mail: seu e-mail atual continua valendo. Este link expira em breve.</p>`,
    });
    this.logger.log(`E-mail de troca de endereço enviado para ${params.to}`);
  }

  async sendTeamUpdate(params: TeamUpdateJobData): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: `${params.tenantName}: ${params.summary}`,
      text: `Olá, ${params.name}!\n\n${params.summary}.\n\nVeja a equipe: ${params.teamUrl}\n\nVocê recebe este aviso porque ativou "Convites e mudanças de permissão" em Configurações → Conta.`,
      html: `<p>Olá, ${h(params.name)}!</p><p>${h(params.summary)}.</p><p><a href="${params.teamUrl}">Ver equipe</a></p><p style="color:#667085;font-size:12px">Você recebe este aviso porque ativou "Convites e mudanças de permissão" em Configurações → Conta.</p>`,
    });
    this.logger.log(`Aviso de equipe enviado para ${params.to}`);
  }

  async sendDailyDigest(params: DailyDigestJobData): Promise<void> {
    const { movements } = params;
    const movementLines = movements
      ? MOVEMENT_LABELS.map(([key, label]) => {
          const { count, units } = movements[key];
          const signed =
            key === 'adjustments' && units > 0 ? `+${units}` : units;
          return `${label}: ${count} (${signed} un.)`;
        })
      : [];
    const alertLines = params.alerts.map(
      (a) =>
        `${a.product} — ${a.branch}: ${a.current} un. (mínimo ${a.min})${a.out ? ' · sem estoque' : ''}`,
    );
    const moreAlerts = params.alertsTotal - params.alerts.length;

    const text = [
      `Olá, ${params.name}!`,
      `Resumo de ${params.day} em ${params.tenantName}.`,
      ...(movementLines.length ? ['', 'Movimentações', ...movementLines] : []),
      '',
      params.alertsTotal
        ? `Alertas de estoque (${params.alertsTotal})`
        : 'Nenhum alerta de estoque.',
      ...alertLines,
      ...(moreAlerts > 0 ? [`e mais ${moreAlerts}.`] : []),
      '',
      `Abrir o estoque: ${params.stockUrl}`,
      '',
      'Para ajustar estes e-mails, acesse Configurações.',
    ].join('\n');

    const html = [
      `<p>Olá, ${h(params.name)}!</p>`,
      `<p>Resumo de <strong>${h(params.day)}</strong> em <strong>${h(params.tenantName)}</strong>.</p>`,
      movementLines.length
        ? `<h3>Movimentações</h3><ul>${movementLines.map((l) => `<li>${h(l)}</li>`).join('')}</ul>`
        : '',
      params.alertsTotal
        ? `<h3>Alertas de estoque (${params.alertsTotal})</h3><ul>${alertLines.map((l) => `<li>${h(l)}</li>`).join('')}</ul>${moreAlerts > 0 ? `<p>e mais ${moreAlerts}.</p>` : ''}`
        : '<p>Nenhum alerta de estoque.</p>',
      `<p><a href="${params.stockUrl}">Abrir o estoque</a></p>`,
      '<p style="color:#667085;font-size:12px">Para ajustar estes e-mails, acesse Configurações.</p>',
    ].join('');

    await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: `${params.tenantName}: resumo de ${params.day}`,
      text,
      html,
    });
    this.logger.log(`Resumo diário enviado para ${params.to}`);
  }
}
