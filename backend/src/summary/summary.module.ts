import { Module } from '@nestjs/common';
import { GoalsModule } from '../goals/goals.module.js';
import { SummaryController } from './summary.controller.js';
import { SummaryService } from './summary.service.js';

@Module({
  imports: [GoalsModule],
  controllers: [SummaryController],
  providers: [SummaryService],
})
export class SummaryModule {}
