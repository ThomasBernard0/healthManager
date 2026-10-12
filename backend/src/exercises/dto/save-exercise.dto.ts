import { EQUIPMENTS, MUSCLES, type Equipment, type Muscle } from '@healthmanager/shared';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsIn, IsInt, IsString, Length, Max, Min } from 'class-validator';

export const MAX_SETS = 10;
export const MAX_REPS = 100;

/** Créer / Modifier l'exercice. A muscle is either primary or secondary, not both; sets × repMin–repMax. */
export class SaveExerciseDto {
  @ApiProperty({ example: 'Rowing barre', minLength: 1, maxLength: 80 })
  @IsString()
  @Length(1, 80)
  name: string;

  @ApiProperty({ enum: EQUIPMENTS, enumName: 'Equipment' })
  @IsIn(EQUIPMENTS)
  equipment: Equipment;

  @ApiProperty({ enum: MUSCLES, enumName: 'Muscle', isArray: true, minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(MUSCLES, { each: true })
  primaryMuscles: Muscle[];

  @ApiProperty({ enum: MUSCLES, enumName: 'Muscle', isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsIn(MUSCLES, { each: true })
  secondaryMuscles: Muscle[];

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
