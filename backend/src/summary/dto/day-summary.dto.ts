import { ApiProperty } from '@nestjs/swagger';
import { NutrientsDeltaDto, NutrientsDto } from '../../common/nutrients.dto.js';
import { GoalDto } from '../../goals/dto/goal.dto.js';
import { LogEntryDto } from '../../log-entries/dto/log-entry.dto.js';

export class WeekProgressDto {
  @ApiProperty({ example: '2026-09-28', description: 'Monday starting the week' })
  monday: string;

  @ApiProperty({ type: NutrientsDto, description: 'Sum of the week (Monday 00:00 → next Monday 00:00)' })
  eaten: NutrientsDto;

  @ApiProperty({ type: NutrientsDto, nullable: true, description: 'Sum of the daily target of each of the 7 days' })
  target: NutrientsDto | null;

  @ApiProperty({ type: NutrientsDeltaDto, nullable: true, description: 'target − eaten (negative when over)' })
  left: NutrientsDeltaDto | null;
}

export class DaySummaryDto {
  @ApiProperty({ example: '2026-10-04' })
  date: string;

  @ApiProperty({ example: '2026-10-04', description: 'Today in Europe/Paris' })
  today: string;

  @ApiProperty({ type: GoalDto, nullable: true, description: 'Goal applying on that date' })
  goal: GoalDto | null;

  @ApiProperty({ type: NutrientsDto })
  eaten: NutrientsDto;

  @ApiProperty({ type: NutrientsDeltaDto, nullable: true, description: 'Daily target − eaten (negative when over)' })
  left: NutrientsDeltaDto | null;

  @ApiProperty({ type: [LogEntryDto], description: 'Ordered by time' })
  entries: LogEntryDto[];

  @ApiProperty({ type: WeekProgressDto })
  week: WeekProgressDto;
}
