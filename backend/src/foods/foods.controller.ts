import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CreateFoodDto } from './dto/create-food.dto.js';
import { FoodDto } from './dto/food.dto.js';
import { FoodsService } from './foods.service.js';

@ApiTags('foods')
@Controller('foods')
export class FoodsController {
  constructor(private readonly foods: FoodsService) {}

  @Get()
  @ApiQuery({ name: 'q', required: false, description: 'Accent/case-insensitive, every word must match' })
  @ApiOkResponse({ type: [FoodDto] })
  search(@Query('q') q?: string): Promise<FoodDto[]> {
    return this.foods.search(q ?? '');
  }

  @Get(':id')
  @ApiOkResponse({ type: FoodDto })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string): Promise<FoodDto> {
    return this.foods.get(id);
  }

  @Post()
  @ApiCreatedResponse({ type: FoodDto })
  create(@Body() dto: CreateFoodDto): Promise<FoodDto> {
    return this.foods.create(dto);
  }
}
