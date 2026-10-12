import { EQUIPMENTS, MUSCLES, type Equipment, type Muscle } from '@healthmanager/shared';
import { ApiProperty } from '@nestjs/swagger';

/** A workout the exercise is part of, with its sets and rep range there. */
export class ExerciseWorkoutDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Pull' })
  name: string;

  @ApiProperty({ example: 4 })
  sets: number;

  @ApiProperty({ example: 8 })
  repMin: number;

  @ApiProperty({ example: 12 })
  repMax: number;

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

  @ApiProperty({
    type: String,
    nullable: true,
    example: '/exercises/rowing-barre.svg',
    description: 'Same-origin path of the line-art drawing (served with the app, tint it with a CSS mask)',
  })
  imageUrl: string | null;

  @ApiProperty({ type: [ExerciseWorkoutDto], description: 'Active program first, then in program and rotation order' })
  workouts: ExerciseWorkoutDto[];
}
