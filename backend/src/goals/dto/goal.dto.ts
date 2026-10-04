import { ApiProperty } from '@nestjs/swagger';

export class GoalDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '2026-09-30', description: 'First day (YYYY-MM-DD) this goal applies to' })
  validFrom: string;

  @ApiProperty({ example: 2200 })
  dailyKcal: number;

  @ApiProperty({ example: 150, description: 'Daily protein (g)' })
  protein: number;

  @ApiProperty({ example: 230, description: 'Daily carbs (g)' })
  carbs: number;

  @ApiProperty({ example: 70, description: 'Daily fat (g)' })
  fat: number;
}

export class CurrentGoalDto {
  @ApiProperty({ example: '2026-10-04', description: 'Today in Europe/Paris' })
  today: string;

  @ApiProperty({ type: GoalDto, nullable: true, description: 'Goal applying today; null before any goal is set' })
  goal: GoalDto | null;
}
