import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { MealDto, MealSummaryDto } from './dto/meal.dto.js';
import { SaveMealDto, SetFavoriteDto } from './dto/save-meal.dto.js';
import { MealsService } from './meals.service.js';

@ApiTags('meals')
@Controller('meals')
export class MealsController {
  constructor(private readonly meals: MealsService) {}

  /** Mes repas: favourites first, then most eaten, then most recent. */
  @Get()
  @ApiQuery({ name: 'q', required: false, description: 'Accent/case-insensitive, matches anywhere in the name' })
  @ApiOkResponse({ type: [MealSummaryDto] })
  list(@Query('q') q?: string): Promise<MealSummaryDto[]> {
    return this.meals.list(q ?? '');
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

  /** Star / unstar. */
  @Patch(':id')
  @ApiOkResponse({ type: MealSummaryDto })
  @ApiNotFoundResponse()
  setFavorite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetFavoriteDto,
  ): Promise<MealSummaryDto> {
    return this.meals.setFavorite(id, dto);
  }

  /** Hard delete; logged days keep their totals. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.meals.remove(id);
  }
}
