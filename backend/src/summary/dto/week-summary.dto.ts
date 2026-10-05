import { ApiProperty } from '@nestjs/swagger';
import { NutrientsDeltaDto, NutrientsDto } from '../../common/nutrients.dto.js';

export class WeekDayDto {
  @ApiProperty({ example: '2026-09-30' })
  date: string;

  @ApiProperty({ type: NutrientsDto })
  eaten: NutrientsDto;

  @ApiProperty({ type: NutrientsDto, nullable: true, description: 'Daily target of that day (its own goal)' })
  target: NutrientsDto | null;

  @ApiProperty({ type: NutrientsDeltaDto, nullable: true, description: 'target − eaten (negative when over)' })
  left: NutrientsDeltaDto | null;
}

export class WeekSummaryDto {
  @ApiProperty({ example: '2026-09-28', description: 'Monday starting the week' })
  monday: string;

  @ApiProperty({ example: '2026-10-04', description: 'Today in Europe/Paris' })
  today: string;

  @ApiProperty({ example: '2026-01-15', description: 'Earliest browsable date: first day with data, else today' })
  earliestDate: string;

  @ApiProperty({ type: [WeekDayDto], description: 'Monday → Sunday' })
  days: WeekDayDto[];

  @ApiProperty({ type: NutrientsDto, description: 'Sum of the 7 days' })
  eaten: NutrientsDto;

  @ApiProperty({ type: NutrientsDto, nullable: true, description: 'Sum of the 7 daily targets' })
  target: NutrientsDto | null;

  @ApiProperty({ type: NutrientsDeltaDto, nullable: true, description: 'target − eaten (negative when over)' })
  left: NutrientsDeltaDto | null;

  @ApiProperty({ example: 7, description: 'Days of the week started by today (0 for a future week)' })
  elapsedDays: number;

  @ApiProperty({ type: NutrientsDto, description: 'Average per elapsed day' })
  average: NutrientsDto;
}
