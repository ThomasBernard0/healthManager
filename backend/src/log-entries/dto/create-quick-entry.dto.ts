import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { NutrientsDto } from '../../common/nutrients.dto.js';
import { IsLocalDate, IsLocalTime } from '../../common/validators.js';

/** A one-time meal (Saisie rapide): logged once, never saved to Mes repas. */
export class CreateQuickEntryDto extends NutrientsDto {
  @ApiProperty({ example: '2026-10-04' })
  @IsLocalDate()
  date: string;

  @ApiProperty({ example: '20:30' })
  @IsLocalTime()
  time: string;

  @ApiProperty({ example: 'Restaurant italien', minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  label: string;
}
