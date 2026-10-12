import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const MAX_SETS = 10;
export const MAX_REPS = 100;

export class SaveWorkoutItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  exerciseId: string;

  @ApiProperty({ example: 4, minimum: 1, maximum: MAX_SETS })
  @IsInt()
  @Min(1)
  @Max(MAX_SETS)
  sets: number;

  @ApiProperty({ example: 8, minimum: 1, maximum: MAX_REPS })
  @IsInt()
  @Min(1)
  @Max(MAX_REPS)
  repMin: number;

  @ApiProperty({ example: 12, minimum: 1, maximum: MAX_REPS, description: '≥ repMin' })
  @IsInt()
  @Min(1)
  @Max(MAX_REPS)
  repMax: number;
}

/** Nouvelle séance / Modifier la séance: name and exercises in list order (each exercise once). */
export class SaveWorkoutDto {
  @ApiProperty({ example: 'Pull', minLength: 1, maxLength: 40 })
  @IsString()
  @Length(1, 40)
  name: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Program of a new workout (default: the active one). Ignored on edit',
  })
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiProperty({ type: [SaveWorkoutItemDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SaveWorkoutItemDto)
  items: SaveWorkoutItemDto[];
}
