import { Module } from '@nestjs/common';
import { MealsController } from './meals.controller.js';
import { MealsService } from './meals.service.js';

@Module({
  controllers: [MealsController],
  providers: [MealsService],
  exports: [MealsService],
})
export class MealsModule {}
