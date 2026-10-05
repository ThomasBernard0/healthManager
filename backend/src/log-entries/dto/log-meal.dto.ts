import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, Max, Min } from 'class-validator';
import { IsLocalDate, IsLocalTime } from '../../common/validators.js';

export const MIN_QUANTITY = 0.25;
export const MAX_QUANTITY = 20;

/** Logs a saved meal: its current totals are frozen into the entry. */
export class LogMealDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  mealId: string;

  @ApiProperty({ example: '2026-10-04' })
  @IsLocalDate()
  date: string;

  @ApiProperty({ example: '12:45' })
  @IsLocalTime()
  time: string;

  @ApiProperty({ example: 1, minimum: MIN_QUANTITY, maximum: MAX_QUANTITY, description: 'Portions' })
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(MIN_QUANTITY)
  @Max(MAX_QUANTITY)
  quantity: number;
}
