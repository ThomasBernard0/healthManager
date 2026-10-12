import { Module } from '@nestjs/common';
import { WorkoutsModule } from '../workouts/workouts.module.js';
import { ProgramsController } from './programs.controller.js';
import { ProgramsService } from './programs.service.js';

@Module({
  imports: [WorkoutsModule],
  controllers: [ProgramsController],
  providers: [ProgramsService],
})
export class ProgramsModule {}
