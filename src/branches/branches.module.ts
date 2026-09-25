import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

@Module({
  imports: [StockModule],
  controllers: [BranchesController],
  providers: [BranchesService],
})
export class BranchesModule {}
