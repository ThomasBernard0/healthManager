import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Length, Max, Min } from 'class-validator';
import { NutrientsDto } from '../../common/nutrients.dto.js';

export const FOOD_SOURCES = ['custom', 'ciqual', 'off'] as const;
export type FoodSourceValue = (typeof FOOD_SOURCES)[number];

/** A household unit of a food, e.g. { label: "c. à s.", grams: 10 }. */
export class FoodUnitDto {
  @ApiProperty({ example: 'c. à s.', minLength: 1, maxLength: 30 })
  @IsString()
  @Length(1, 30)
  label: string;

  @ApiProperty({ example: 10, minimum: 0.1, maximum: 2000 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.1)
  @Max(2000)
  grams: number;
}

export class FoodDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Riz blanc, cuit, non salé' })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  brand: string | null;

  @ApiProperty({ enum: FOOD_SOURCES, enumName: 'FoodSource' })
  source: FoodSourceValue;

  @ApiProperty({ type: NutrientsDto, description: 'Per 100 g' })
  per100g: NutrientsDto;

  @ApiProperty({ type: [FoodUnitDto] })
  units: FoodUnitDto[];
}
