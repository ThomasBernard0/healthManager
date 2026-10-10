import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { IsWeight } from '../../common/validators.js';
import { FEELINGS, type Feeling } from './session.dto.js';

export class StartSessionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  workoutId: string;
}

/**
 * Saves a set row. done = true validates it: empty values (null/absent) record the target.
 * done = false reopens it.
 */
export class SaveSetDto {
  @ApiPropertyOptional({ type: Number, nullable: true, example: 60, description: 'kg, 0.5 kg steps' })
  @IsOptional()
  @IsWeight()
  weight?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 10, minimum: 0, maximum: 200 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  reps?: number | null;

  @ApiProperty()
  @IsBoolean()
  done: boolean;
}

/** Ressenti and/or Terminé. */
export class UpdateSessionExerciseDto {
  @ApiPropertyOptional({ enum: FEELINGS, enumName: 'Feeling', nullable: true })
  @IsOptional()
  @IsIn(FEELINGS)
  feeling?: Feeling | null;

  @ApiPropertyOptional({ description: 'Terminé (needs at least one validated set)' })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
