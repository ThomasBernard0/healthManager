import { ApiProperty } from '@nestjs/swagger';
import { ExerciseDto } from '../../exercises/dto/exercise.dto.js';

export const FEELINGS = ['easy', 'ok', 'hard'] as const;
export type Feeling = (typeof FEELINGS)[number];

export const EXERCISE_STATUSES = ['todo', 'inProgress', 'done'] as const;
export type ExerciseStatus = (typeof EXERCISE_STATUSES)[number];

export class SessionSetDto {
  @ApiProperty({ example: 0, description: 'From 0, in workout order' })
  index: number;

  @ApiProperty({ type: Number, nullable: true, example: 60, description: 'kg; null: no target (first time)' })
  targetWeight: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 10 })
  targetReps: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 60, description: 'kg, as done (or typed, not validated yet)' })
  weight: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 10 })
  reps: number | null;

  @ApiProperty()
  done: boolean;
}

/** A row of the Séance list: status only, no targets or results. */
export class SessionExerciseSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: ExerciseDto })
  exercise: ExerciseDto;

  @ApiProperty({
    enum: EXERCISE_STATUSES,
    enumName: 'SessionExerciseStatus',
    description: 'done: Terminé tapped; inProgress: a set validated; todo: nothing yet',
  })
  status: ExerciseStatus;
}

export class SessionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'null once the workout is deleted' })
  workoutId: string | null;

  @ApiProperty({ example: 'Pull' })
  workoutName: string;

  @ApiProperty({ type: String, format: 'date-time' })
  startedAt: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt: string | null;

  @ApiProperty({ type: [SessionExerciseSummaryDto], description: 'In workout order' })
  exercises: SessionExerciseSummaryDto[];
}

/** The session in progress, if any (it survives reloads). */
export class CurrentSessionDto {
  @ApiProperty({ type: SessionDto, nullable: true })
  session: SessionDto | null;
}

export class SetResultDto {
  @ApiProperty({ example: 60, description: 'kg' })
  weight: number;

  @ApiProperty({ example: 10 })
  reps: number;
}

/** "Dernière fois": the sets of the last finished session with this exercise. */
export class LastTimeDto {
  @ApiProperty({ type: String, format: 'date', description: 'Europe/Paris date' })
  date: string;

  @ApiProperty({ type: [SetResultDto] })
  sets: SetResultDto[];
}

/** Exercice en cours. */
export class SessionExerciseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty({ example: 'Pull' })
  workoutName: string;

  @ApiProperty({ type: ExerciseDto })
  exercise: ExerciseDto;

  @ApiProperty({ example: 8 })
  repMin: number;

  @ApiProperty({ example: 12 })
  repMax: number;

  @ApiProperty({ enum: FEELINGS, enumName: 'Feeling', nullable: true })
  feeling: Feeling | null;

  @ApiProperty({ description: 'Terminé tapped' })
  completed: boolean;

  @ApiProperty({ type: [SessionSetDto] })
  sets: SessionSetDto[];

  @ApiProperty({ type: LastTimeDto, nullable: true })
  lastTime: LastTimeDto | null;
}
