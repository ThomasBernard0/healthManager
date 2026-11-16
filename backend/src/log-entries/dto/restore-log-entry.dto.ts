import { MAX_PORTIONS } from '@healthmanager/shared';
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
import { MAX_FOOD_GRAMS } from './log-food.dto.js';
import { LOG_KINDS, type LogKindValue } from './log-entry.dto.js';

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

  @ApiProperty({ type: String, format: 'uuid', nullable: true, required: false })
  @IsOptional()
  @IsUUID()
  foodId?: string | null;

  @ApiProperty({ example: 'Bowl poulet riz', minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  label: string;

  @ApiProperty({ example: 1, minimum: 0.01, maximum: MAX_PORTIONS })
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_PORTIONS)
  quantity: number;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0.1, maximum: MAX_FOOD_GRAMS })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 1 })
  @Min(0.1)
  @Max(MAX_FOOD_GRAMS)
  grams?: number | null;

  @ApiProperty({ type: NutrientsDto })
  @ValidateNested()
  @Type(() => NutrientsDto)
  snapshot: NutrientsDto;
}
