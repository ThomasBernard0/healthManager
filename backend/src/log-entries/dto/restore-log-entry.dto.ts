import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
import { IsLocalDate, IsLocalTime } from '../../common/validators.js';
import { LOG_KINDS, type LogKindValue } from './log-entry.dto.js';
import { MAX_QUANTITY, MIN_QUANTITY } from './log-meal.dto.js';

/** Re-creates a deleted entry as it was (undo). */
export class RestoreLogEntryDto {
  @ApiProperty({ example: '2026-10-04' })
  @IsLocalDate()
  date: string;

  @ApiProperty({ example: '12:45' })
  @IsLocalTime()
  time: string;

  @ApiProperty({ enum: LOG_KINDS, enumName: 'LogKind' })
  @IsIn(LOG_KINDS)
  kind: LogKindValue;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, required: false })
  @IsOptional()
  @IsUUID()
  mealId?: string | null;

  @ApiProperty({ example: 'Bowl poulet riz', minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  label: string;

  @ApiProperty({ example: 1, minimum: MIN_QUANTITY, maximum: MAX_QUANTITY })
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(MIN_QUANTITY)
  @Max(MAX_QUANTITY)
  quantity: number;

  @ApiProperty({ type: NutrientsDto })
  @ValidateNested()
  @Type(() => NutrientsDto)
  snapshot: NutrientsDto;
}
