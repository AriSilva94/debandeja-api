import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import {
  TENANT_PURGE_QUEUE,
  TenantPurgeProcessor,
} from './purge/tenant-purge.processor';

@Module({
  imports: [BullModule.registerQueue({ name: TENANT_PURGE_QUEUE })],
  controllers: [BillingController],
  providers: [BillingService, TenantPurgeProcessor],
})
export class BillingModule {}
