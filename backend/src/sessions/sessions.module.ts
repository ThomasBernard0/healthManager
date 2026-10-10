import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller.js';
import { ProgressionService } from './progression.service.js';
import { SessionsService } from './sessions.service.js';

@Module({
  controllers: [SessionsController],
  providers: [SessionsService, ProgressionService],
  exports: [ProgressionService],
})
export class SessionsModule {}
