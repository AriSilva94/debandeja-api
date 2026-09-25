import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StockModule } from '../stock/stock.module';
import { TeamNotifier } from './team-notifier.service';
import {
  DAILY_DIGEST_QUEUE,
  DailyDigestProcessor,
} from './daily-digest.processor';

@Module({
  imports: [
    StockModule,
    BullModule.registerQueue({ name: DAILY_DIGEST_QUEUE }),
  ],
  providers: [TeamNotifier, DailyDigestProcessor],
  exports: [TeamNotifier],
})
export class NotificationsModule {}
