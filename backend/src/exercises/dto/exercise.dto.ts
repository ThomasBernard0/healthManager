import { EQUIPMENTS, MUSCLES, type Equipment, type Muscle } from '@healthmanager/shared';
import { ApiProperty } from '@nestjs/swagger';

/** A workout the exercise is part of. */
export class ExerciseWorkoutDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Pull' })
  name: string;

  @ApiProperty({ format: 'uuid' })
  programId: string;

  @ApiProperty({ description: 'The workout is in the active program' })
  programActive: boolean;
}

export class ExerciseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Rowing barre' })
  name: string;

  @ApiProperty({ enum: EQUIPMENTS, enumName: 'Equipment' })
  equipment: Equipment;

  @ApiProperty({ enum: MUSCLES, enumName: 'Muscle', isArray: true })
  primaryMuscles: Muscle[];

  @ApiProperty({ enum: MUSCLES, enumName: 'Muscle', isArray: true })
  secondaryMuscles: Muscle[];

  @ApiProperty({ example: 4, description: 'Sets, in every workout' })
  sets: number;

  @ApiProperty({ example: 8 })
  repMin: number;

  @ApiProperty({ example: 12 })
  repMax: number;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '1791800000000',
    description: 'Changes with the image (null: no image). Pass it as ?v= to GET /exercises/:id/image',
  })
  imageVersion: string | null;

  @ApiProperty({ type: [ExerciseWorkoutDto], description: 'Active program first, then in program and rotation order' })
  workouts: ExerciseWorkoutDto[];
}
