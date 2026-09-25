import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { MailSenderService } from './mail-sender.service';
import {
  MAIL_QUEUE,
  type EmailChangeJobData,
  type EmailVerificationJobData,
  type InviteJobData,
  type MailJobName,
  type PasswordResetJobData,
  type TeamUpdateJobData,
  type DailyDigestJobData,
} from './mail-job.type';

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailSender: MailSenderService) {
    super();
  }

  async process(job: Job<unknown, void, MailJobName>): Promise<void> {
    switch (job.name) {
      case 'invite':
        return this.mailSender.sendInvite(job.data as InviteJobData);
      case 'email-verification':
        return this.mailSender.sendEmailVerification(
          job.data as EmailVerificationJobData,
        );
      case 'password-reset':
        return this.mailSender.sendPasswordReset(
          job.data as PasswordResetJobData,
        );
      case 'email-change':
        return this.mailSender.sendEmailChange(job.data as EmailChangeJobData);
      case 'team-update':
        return this.mailSender.sendTeamUpdate(job.data as TeamUpdateJobData);
      case 'daily-digest':
        return this.mailSender.sendDailyDigest(job.data as DailyDigestJobData);
      default:
        this.logger.warn(
          `Job de e-mail com nome desconhecido: ${job.name as string}`,
        );
    }
  }
}
