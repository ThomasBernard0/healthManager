import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { parseBarcodeParam } from '../common/validators.js';
import { BarcodeLookupDto } from './dto/barcode-lookup.dto.js';
import { CreateFoodDto } from './dto/create-food.dto.js';
import { FoodDto } from './dto/food.dto.js';
import { FoodInUseDto } from './dto/food-in-use.dto.js';
import { UpdateFoodDto } from './dto/update-food.dto.js';
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

  /** Every food, by name (Mes repas → Ingrédients). */
  @Get('all')
  @ApiOkResponse({ type: [FoodDto] })
  listAll(): Promise<FoodDto[]> {
    return this.foods.listAll();
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

  @Put(':id')
  @ApiOkResponse({ type: FoodDto })
  @ApiNotFoundResponse()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFoodDto): Promise<FoodDto> {
    return this.foods.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ type: FoodInUseDto, description: 'A saved meal uses this food' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.foods.remove(id);
  }
}
