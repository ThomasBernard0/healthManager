import { ApiProperty } from '@nestjs/swagger';
import { NutrientsDto } from '../../common/nutrients.dto.js';
import { FoodDto } from '../../foods/dto/food.dto.js';

export const MEAL_MODES = ['ingredients', 'manual'] as const;
export type MealModeValue = (typeof MEAL_MODES)[number];

export const TOTALS_SOURCES = ['ingredients', 'manual', 'override'] as const;
export type TotalsSourceValue = (typeof TOTALS_SOURCES)[number];

/** A saved meal as listed in "Mes repas". */
export class MealSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Fajitas poulet' })
  name: string;

  @ApiProperty({ enum: MEAL_MODES, enumName: 'MealMode' })
  mode: MealModeValue;

  @ApiProperty()
  isFavorite: boolean;

  @ApiProperty({ type: NutrientsDto, description: 'One portion' })
  totals: NutrientsDto;

  @ApiProperty({ enum: TOTALS_SOURCES, enumName: 'MealTotalsSource', description: 'Which totals are in use' })
  totalsSource: TotalsSourceValue;

  @ApiProperty({ example: 12, description: 'Number of times logged' })
  timesEaten: number;

  @ApiProperty({ type: String, nullable: true, example: '2026-10-03', description: 'Last day it was logged' })
  lastEatenOn: string | null;
}

export class MealItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: FoodDto })
  food: FoodDto;

  @ApiProperty({ example: 220 })
  grams: number;

  @ApiProperty({ type: String, nullable: true, example: 'c. à s.', description: 'Unit it was entered with' })
  unitLabel: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 1 })
  unitCount: number | null;

  @ApiProperty({ type: NutrientsDto, description: 'grams / 100 × per100g' })
  nutrients: NutrientsDto;
}

/** A saved meal with everything needed to edit it. */
export class MealDto extends MealSummaryDto {
  @ApiProperty({ type: [MealItemDto], description: 'Ingredients mode' })
  items: MealItemDto[];

  @ApiProperty({ type: NutrientsDto, nullable: true, description: 'Manual mode totals' })
  manualTotals: NutrientsDto | null;

  @ApiProperty({ type: NutrientsDto, nullable: true, description: 'Manual correction of the totals' })
  override: NutrientsDto | null;
}
