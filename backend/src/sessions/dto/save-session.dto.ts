import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { IsWeight } from '../../common/validators.js';

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
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 60,
    minimum: -1000,
    maximum: 1000,
    description: 'kg, 0.5 kg steps; < 0: help from an assisted machine (bodyweight exercises only)',
  })
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

/** Facile and/or Terminé. */
export class UpdateSessionExerciseDto {
  @ApiPropertyOptional({ description: 'Facile tapped' })
  @IsOptional()
  @IsBoolean()
  easy?: boolean;

  @ApiPropertyOptional({ description: 'Terminé (needs at least one validated set)' })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
