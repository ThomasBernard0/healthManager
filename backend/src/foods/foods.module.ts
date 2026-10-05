import { Module } from '@nestjs/common';
import { FoodsController } from './foods.controller.js';
import { FoodsService } from './foods.service.js';

@Module({
  controllers: [FoodsController],
  providers: [FoodsService],
})
export class FoodsModule {}
