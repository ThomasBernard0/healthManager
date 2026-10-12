import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Length, ValidateNested } from 'class-validator';

export class SaveWorkoutItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  exerciseId: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    minLength: 1,
    maxLength: 36,
    description: 'Superset: any id shared by exactly two adjacent items (replaced by the server)',
  })
  @IsOptional()
  @IsString()
  @Length(1, 36)
  group?: string | null;
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
