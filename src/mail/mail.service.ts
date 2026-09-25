import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  MAIL_QUEUE,
  type InviteJobData,
  type EmailVerificationJobData,
  type PasswordResetJobData,
  type EmailChangeJobData,
  type TeamUpdateJobData,
  type DailyDigestJobData,
} from './mail-job.type';

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
} as const;

@Injectable()
export class MailService {
  constructor(@InjectQueue(MAIL_QUEUE) private readonly queue: Queue) {}

  async sendInvite(data: InviteJobData): Promise<void> {
    await this.queue.add('invite', data, JOB_OPTIONS);
  }

  async sendEmailVerification(data: EmailVerificationJobData): Promise<void> {
    await this.queue.add('email-verification', data, JOB_OPTIONS);
  }

  async sendPasswordReset(data: PasswordResetJobData): Promise<void> {
    await this.queue.add('password-reset', data, JOB_OPTIONS);
  }

  async sendEmailChange(data: EmailChangeJobData): Promise<void> {
    await this.queue.add('email-change', data, JOB_OPTIONS);
  }

  async sendTeamUpdate(data: TeamUpdateJobData): Promise<void> {
    await this.queue.add('team-update', data, JOB_OPTIONS);
  }

  async sendDailyDigest(
    data: DailyDigestJobData,
    dedupeKey: string,
  ): Promise<void> {
    await this.queue.add('daily-digest', data, {
      ...JOB_OPTIONS,
      jobId: dedupeKey,
      removeOnComplete: { age: 2 * 24 * 60 * 60 },
    });
  }
}
