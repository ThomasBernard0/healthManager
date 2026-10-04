import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { IsLocalDate, IsLocalTime } from '../../common/validators.js';

export const MIN_QUANTITY = 0.25;
export const MAX_QUANTITY = 20;

export class UpdateLogEntryDto {
  @ApiPropertyOptional({ example: 1.5, minimum: MIN_QUANTITY, maximum: MAX_QUANTITY })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(MIN_QUANTITY)
  @Max(MAX_QUANTITY)
  quantity?: number;

  @ApiPropertyOptional({ example: '13:00' })
  @IsOptional()
  @IsLocalTime()
  time?: string;

  @ApiPropertyOptional({ example: '2026-10-03' })
  @IsOptional()
  @IsLocalDate()
  date?: string;
}

export class DuplicateLogEntryDto {
  @ApiProperty({ example: '2026-10-05', description: 'Day to copy the entry to' })
  @IsLocalDate()
  date: string;

  @ApiPropertyOptional({ example: '12:30', description: 'Defaults to the original time' })
  @IsOptional()
  @IsLocalTime()
  time?: string;
}
