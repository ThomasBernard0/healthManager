import { Module } from '@nestjs/common';
import { FoodsController } from './foods.controller.js';
import { FoodsService } from './foods.service.js';
import { OpenFoodFactsClient } from './open-food-facts.client.js';

@Module({
  controllers: [FoodsController],
  providers: [FoodsService, OpenFoodFactsClient],
})
export class FoodsModule {}
