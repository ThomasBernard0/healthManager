import { Module } from '@nestjs/common';
import { TonnageController } from './tonnage.controller.js';
import { TonnageService } from './tonnage.service.js';

@Module({
  controllers: [TonnageController],
  providers: [TonnageService],
})
export class TonnageModule {}
