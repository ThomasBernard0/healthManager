import { Body, Controller, Get, Param, ParseBoolPipe, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { MealDto, MealSummaryDto } from './dto/meal.dto.js';
import { SaveMealDto, UpdateMealFlagsDto } from './dto/save-meal.dto.js';
import { MealsService } from './meals.service.js';

@ApiTags('meals')
@Controller('meals')
export class MealsController {
  constructor(private readonly meals: MealsService) {}

  /** Mes repas: favourites first, then most eaten, then most recent. */
  @Get()
  @ApiQuery({ name: 'q', required: false, description: 'Accent/case-insensitive, matches anywhere in the name' })
  @ApiQuery({ name: 'archived', required: false, type: Boolean })
  @ApiOkResponse({ type: [MealSummaryDto] })
  list(
    @Query('q') q?: string,
    @Query('archived', new ParseBoolPipe({ optional: true })) archived?: boolean,
  ): Promise<MealSummaryDto[]> {
    return this.meals.list(q ?? '', archived ?? false);
  }

  @Get(':id')
  @ApiOkResponse({ type: MealDto })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string): Promise<MealDto> {
    return this.meals.get(id);
  }

  @Post()
  @ApiCreatedResponse({ type: MealDto })
  create(@Body() dto: SaveMealDto): Promise<MealDto> {
    return this.meals.create(dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: MealDto })
  @ApiNotFoundResponse()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveMealDto): Promise<MealDto> {
    return this.meals.update(id, dto);
  }

  /** Favourite / archive. */
  @Patch(':id')
  @ApiOkResponse({ type: MealSummaryDto })
  @ApiNotFoundResponse()
  setFlags(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMealFlagsDto,
  ): Promise<MealSummaryDto> {
    return this.meals.setFlags(id, dto);
  }
}
