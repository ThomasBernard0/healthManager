import { ApiProperty } from '@nestjs/swagger';
import { WorkoutSummaryDto } from '../../workouts/dto/workout.dto.js';

/** Mes programmes. */
export class ProgramSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Push Pull' })
  name: string;

  @ApiProperty({ example: 1, description: 'Order in Mes programmes, from 1' })
  position: number;

  @ApiProperty({ description: 'The one active program: its séances are the rotation' })
  active: boolean;

  @ApiProperty({ example: 3 })
  workoutCount: number;
}

/** Programme: its séances in rotation order. */
export class ProgramDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Push Pull' })
  name: string;

  @ApiProperty({ example: 1 })
  position: number;

  @ApiProperty()
  active: boolean;

  @ApiProperty({ type: [WorkoutSummaryDto], description: 'In rotation order; the next one flagged if active' })
  workouts: WorkoutSummaryDto[];
}
