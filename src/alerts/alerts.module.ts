import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [StockModule],
  controllers: [AlertsController],
  providers: [AlertsService],
})
export class AlertsModule {}
