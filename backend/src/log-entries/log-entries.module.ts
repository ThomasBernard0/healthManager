import { Module } from '@nestjs/common';
import { MealsModule } from '../meals/meals.module.js';
import { LogEntriesController } from './log-entries.controller.js';
import { LogEntriesService } from './log-entries.service.js';

@Module({
  imports: [MealsModule],
  controllers: [LogEntriesController],
  providers: [LogEntriesService],
})
export class LogEntriesModule {}
