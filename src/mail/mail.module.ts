import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailService } from './mail.service';
import { MailSenderService } from './mail-sender.service';
import { MailProcessor } from './mail.processor';
import { MAIL_QUEUE } from './mail-job.type';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: MAIL_QUEUE })],
  providers: [MailService, MailSenderService, MailProcessor],
  exports: [MailService],
})
export class MailModule {}
