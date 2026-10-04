import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

export const MAX_KCAL = 20000;
export const MAX_GRAMS = 5000;

/** kcal (integer) and macros in grams (0.1 g). */
export class NutrientsDto {
  @ApiProperty({ example: 640, minimum: 0, maximum: MAX_KCAL })
  @IsInt()
  @Min(0)
  @Max(MAX_KCAL)
  kcal: number;

  @ApiProperty({ example: 48, minimum: 0, maximum: MAX_GRAMS })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_GRAMS)
  protein: number;

  @ApiProperty({ example: 72, minimum: 0, maximum: MAX_GRAMS })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_GRAMS)
  carbs: number;

  @ApiProperty({ example: 16, minimum: 0, maximum: MAX_GRAMS })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_GRAMS)
  fat: number;
}

/** Signed nutrients (e.g. what is left, negative when over target). */
export class NutrientsDeltaDto {
  @ApiProperty({ example: 740 })
  kcal: number;

  @ApiProperty({ example: 62 })
  protein: number;

  @ApiProperty({ example: 50 })
  carbs: number;

  @ApiProperty({ example: 29 })
  fat: number;
}
