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
import {
  dailyDigestEmail,
  emailChangeEmail,
  inviteEmail,
  passwordResetEmail,
  teamUpdateEmail,
  verificationEmail,
  type RenderedEmail,
} from './templates/emails';

@Injectable()
export class MailSenderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MailSenderService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly appUrl: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>('MAIL_FROM')!;
    this.appUrl = this.config.get<string>('APP_URL')!;
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

  private async send(to: string, email: RenderedEmail, kind: string) {
    await this.transporter.sendMail({ from: this.from, to, ...email });
    this.logger.log(`${kind} enviado para ${to}`);
  }

  sendInvite(data: InviteJobData) {
    return this.send(data.to, inviteEmail(data, this.appUrl), 'Convite');
  }

  sendEmailVerification(data: EmailVerificationJobData) {
    return this.send(
      data.to,
      verificationEmail(data, this.appUrl),
      'E-mail de verificação',
    );
  }

  sendPasswordReset(data: PasswordResetJobData) {
    return this.send(
      data.to,
      passwordResetEmail(data, this.appUrl),
      'E-mail de redefinição de senha',
    );
  }

  sendEmailChange(data: EmailChangeJobData) {
    return this.send(
      data.to,
      emailChangeEmail(data, this.appUrl),
      'E-mail de troca de endereço',
    );
  }

  sendTeamUpdate(data: TeamUpdateJobData) {
    return this.send(
      data.to,
      teamUpdateEmail(data, this.appUrl),
      'Aviso de equipe',
    );
  }

  sendDailyDigest(data: DailyDigestJobData) {
    return this.send(
      data.to,
      dailyDigestEmail(data, this.appUrl),
      'Resumo diário',
    );
  }
}
