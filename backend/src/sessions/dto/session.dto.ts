import { ApiProperty } from '@nestjs/swagger';
import { ExerciseDto } from '../../exercises/dto/exercise.dto.js';

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

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When ✓ was tapped' })
  doneAt: string | null;
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

  @ApiProperty({ example: 3, description: 'Sets already done on its primary muscles (> 0: battery icon)' })
  preFatigue: number;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Superset: shared with the exercise next to it (null: solo)',
  })
  supersetGroup: string | null;
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

/** A set of a past session, with what was targeted. */
export class LoggedSetDto {
  @ApiProperty({ example: 60, description: 'kg (< 0: help)' })
  weight: number;

  @ApiProperty({ example: 10 })
  reps: number;

  @ApiProperty({ type: Number, nullable: true, example: 60, description: 'null: no target (first time)' })
  targetWeight: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 10 })
  targetReps: number | null;
}

/** A finished session of an exercise: what nextTargets / judge need, and "Dernière fois". */
export class ExerciseLogDto {
  @ApiProperty({ type: String, format: 'date', description: 'Europe/Paris date it was finished' })
  date: string;

  @ApiProperty({ type: [LoggedSetDto], description: 'The validated sets, in order' })
  sets: LoggedSetDto[];

  @ApiProperty({ description: 'Facile tapped' })
  easy: boolean;

  @ApiProperty({ example: 3 })
  preFatigue: number;

  @ApiProperty({ description: 'Every planned set was done (false: stopped early)' })
  complete: boolean;
}

/** An exercise of the session, with everything the phone needs to compute its targets. */
export class SessionBundleExerciseDto {
  @ApiProperty({ format: 'uuid', description: 'Session exercise' })
  id: string;

  @ApiProperty({ type: ExerciseDto })
  exercise: ExerciseDto;

  @ApiProperty({ example: 8, description: 'Rep range when the session started' })
  repMin: number;

  @ApiProperty({ example: 12 })
  repMax: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Superset group (null: solo)' })
  supersetGroup: string | null;

  @ApiProperty({ description: 'Facile tapped' })
  easy: boolean;

  @ApiProperty({ description: 'Terminé tapped' })
  completed: boolean;

  @ApiProperty({ type: [SessionSetDto], description: 'One per set of the session (the set count)' })
  sets: SessionSetDto[];

  @ApiProperty({ type: [ExerciseLogDto], description: 'The last three finished sessions, most recent first' })
  history: ExerciseLogDto[];

  @ApiProperty({ type: [Number], description: 'Distinct weights already logged (kg)' })
  knownWeights: number[];

  @ApiProperty({ example: 5, description: 'Weight step of its equipment (kg)' })
  step: number;
}

/** Démarrer: everything the phone needs to run the session without the network. */
export class SessionBundleDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  workoutId: string | null;

  @ApiProperty({ example: 'Pull' })
  workoutName: string;

  @ApiProperty({ type: String, format: 'date-time' })
  startedAt: string;

  @ApiProperty({ type: [SessionBundleExerciseDto], description: 'In workout order' })
  exercises: SessionBundleExerciseDto[];
}
