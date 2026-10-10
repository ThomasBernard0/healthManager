import { ApiProperty } from '@nestjs/swagger';
import { ExerciseDto } from '../../exercises/dto/exercise.dto.js';
import { SetResultDto } from '../../sessions/dto/session.dto.js';

export class WorkoutSummaryExerciseDto {
  @ApiProperty({ example: 'Rowing barre' })
  name: string;

  @ApiProperty({
    type: [SetResultDto],
    nullable: true,
    description: 'Next targets, for the next workout only (null otherwise, or the first time)',
  })
  targets: SetResultDto[] | null;
}

/** Mes séances / Prochaine séance. */
export class WorkoutSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Pull' })
  name: string;

  @ApiProperty({ example: 2, description: 'Order in the rotation, from 1' })
  position: number;

  @ApiProperty({ type: [WorkoutSummaryExerciseDto], description: 'In list order' })
  exercises: WorkoutSummaryExerciseDto[];

  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    description: 'Europe/Paris date of the last finished session of this workout',
  })
  lastDoneOn: string | null;

  @ApiProperty({ description: 'Next in the rotation (after the workout of the last finished session)' })
  isNext: boolean;
}

export class WorkoutItemDto {
  @ApiProperty({ type: ExerciseDto })
  exercise: ExerciseDto;

  @ApiProperty({ example: 4 })
  sets: number;

  @ApiProperty({ example: 8 })
  repMin: number;

  @ApiProperty({ example: 12 })
  repMax: number;
}

export class WorkoutDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Pull' })
  name: string;

  @ApiProperty({ example: 2 })
  position: number;

  @ApiProperty({ type: [WorkoutItemDto], description: 'In list order' })
  items: WorkoutItemDto[];
}
