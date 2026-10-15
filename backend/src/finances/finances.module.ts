import { Module } from '@nestjs/common';
import { FinanceLinesController } from './finances.controller.js';
import { FinancesService } from './finances.service.js';

@Module({
  controllers: [FinanceLinesController],
  providers: [FinancesService],
})
export class FinancesModule {}
