import { EQUIPMENTS, MUSCLES, type Equipment, type Muscle } from '@healthmanager/shared';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsIn, IsString, Length } from 'class-validator';

/** Créer / Modifier l'exercice. A muscle is either primary or secondary, not both. */
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
}
