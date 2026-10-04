import { Module } from '@nestjs/common';
import { LogEntriesController } from './log-entries.controller.js';
import { LogEntriesService } from './log-entries.service.js';

@Module({
  controllers: [LogEntriesController],
  providers: [LogEntriesService],
})
export class LogEntriesModule {}
