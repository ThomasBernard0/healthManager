import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { parseBarcodeParam } from '../common/validators.js';
import { BarcodeLookupDto } from './dto/barcode-lookup.dto.js';
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

  @Get('barcode/:code')
  @ApiOkResponse({ type: BarcodeLookupDto })
  @ApiBadRequestResponse({ description: 'Not a valid EAN/UPC barcode' })
  @ApiBadGatewayResponse({ description: 'Open Food Facts unreachable' })
  lookupBarcode(@Param('code') code: string): Promise<BarcodeLookupDto> {
    return this.foods.lookupBarcode(parseBarcodeParam(code));
  }

  @Get(':id')
  @ApiOkResponse({ type: FoodDto })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string): Promise<FoodDto> {
    return this.foods.get(id);
  }

  @Post()
  @ApiCreatedResponse({ type: FoodDto })
  @ApiConflictResponse({ description: 'A food already has this barcode' })
  create(@Body() dto: CreateFoodDto): Promise<FoodDto> {
    return this.foods.create(dto);
  }
}
