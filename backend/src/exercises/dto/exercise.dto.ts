import { EQUIPMENTS, MUSCLES, type Equipment, type Muscle } from '@healthmanager/shared';
import { ApiProperty } from '@nestjs/swagger';

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
}
