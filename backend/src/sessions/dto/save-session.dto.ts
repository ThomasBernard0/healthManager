import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsWeight } from '../../common/validators.js';

export class StartSessionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  workoutId: string;
}

/** A set row as the phone left it. */
export class FinishSetDto {
  @ApiProperty({ example: 0, minimum: 0, description: 'From 0, below the set count of the exercise in the session' })
  @IsInt()
  @Min(0)
  index: number;

  @ApiProperty({ type: Number, nullable: true, example: 60, description: 'kg, frozen at the first set; null: no target' })
  @IsOptional()
  @IsWeight()
  targetWeight: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  targetReps: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 60,
    minimum: -1000,
    maximum: 1000,
    description: 'kg, 0.5 kg steps; < 0: help from an assisted machine (bodyweight exercises only)',
  })
  @IsOptional()
  @IsWeight()
  weight: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 10, minimum: 0, maximum: 200 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  reps: number | null;

  @ApiProperty({ description: 'Validated (✓): weight, reps and doneAt are then required' })
  @IsBoolean()
  done: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When ✓ was tapped (phone clock)' })
  @IsOptional()
  @IsISO8601({ strict: true })
  doneAt: string | null;
}

/** An exercise of the session as the phone left it. */
export class FinishExerciseDto {
  @ApiProperty({ format: 'uuid', description: 'Session exercise' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'Facile tapped' })
  @IsBoolean()
  easy: boolean;

  @ApiProperty({ description: 'Terminé tapped' })
  @IsBoolean()
  completed: boolean;

  @ApiProperty({ type: [FinishSetDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FinishSetDto)
  sets: FinishSetDto[];
}

/** Terminer la séance: the whole session, run on the phone. */
export class FinishSessionDto {
  @ApiProperty({ type: [FinishExerciseDto], description: 'Exercises left out keep what the server has' })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FinishExerciseDto)
  exercises: FinishExerciseDto[];
}
