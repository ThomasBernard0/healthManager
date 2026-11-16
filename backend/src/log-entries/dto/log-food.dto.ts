import { MAX_PORTIONS } from '@healthmanager/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { IsLocalDate, IsLocalTime } from '../../common/validators.js';

export const MAX_FOOD_GRAMS = 5000;

const NUMBER = { allowNaN: false, allowInfinity: false } as const;

/** Logs a food on its own (no meal): exactly one of portions (food with a portion) or grams. */
export class LogFoodDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  foodId: string;

  @ApiProperty({ example: '2026-10-04' })
  @IsLocalDate()
  date: string;

  @ApiProperty({ example: '12:45' })
  @IsLocalTime()
  time: string;

  @ApiPropertyOptional({ example: 2, minimum: 0.01, maximum: MAX_PORTIONS, description: 'Portions of the food' })
  @IsOptional()
  @IsNumber({ ...NUMBER, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_PORTIONS)
  portions?: number;

  @ApiPropertyOptional({ example: 150, minimum: 0.1, maximum: MAX_FOOD_GRAMS })
  @IsOptional()
  @IsNumber({ ...NUMBER, maxDecimalPlaces: 1 })
  @Min(0.1)
  @Max(MAX_FOOD_GRAMS)
  grams?: number;
}
