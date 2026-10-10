import { ApiProperty } from '@nestjs/swagger';

/** A done (or targeted) set: weight and reps. */
export class SetResultDto {
  @ApiProperty({ example: 60, description: 'kg' })
  weight: number;

  @ApiProperty({ example: 10 })
  reps: number;
}
