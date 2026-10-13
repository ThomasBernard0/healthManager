import { MAX_PORTIONS } from '@healthmanager/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { NutrientsDto } from '../../common/nutrients.dto.js';
import { MEAL_MODES, type MealModeValue } from './meal.dto.js';

export class MealItemInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  foodId: string;

  @ApiProperty({ example: 220, minimum: 0.1, maximum: 5000 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.1)
  @Max(5000)
  grams: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 2,
    minimum: 0.01,
    maximum: MAX_PORTIONS,
    description: 'Count when the quantity was entered in portions of the food (display only)',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_PORTIONS)
  portions?: number | null;
}

/** Create or replace a saved meal. */
export class SaveMealDto {
  @ApiProperty({ example: 'Salade de pâtes au thon', minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiProperty({ enum: MEAL_MODES, enumName: 'MealMode' })
  @IsIn(MEAL_MODES)
  mode: MealModeValue;

  @ApiProperty({ type: [MealItemInputDto], description: 'Required (≥ 1) in ingredients mode, ignored in manual mode' })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => MealItemInputDto)
  items: MealItemInputDto[];

  @ApiPropertyOptional({ type: NutrientsDto, nullable: true, description: 'Required in manual mode' })
  @IsOptional()
  @ValidateNested()
  @Type(() => NutrientsDto)
  manualTotals?: NutrientsDto | null;

  @ApiPropertyOptional({ type: NutrientsDto, nullable: true, description: 'Manual correction; null clears it' })
  @IsOptional()
  @ValidateNested()
  @Type(() => NutrientsDto)
  override?: NutrientsDto | null;

  @ApiProperty()
  @IsBoolean()
  isFavorite: boolean;
}

export class SetFavoriteDto {
  @ApiProperty()
  @IsBoolean()
  isFavorite: boolean;
}
