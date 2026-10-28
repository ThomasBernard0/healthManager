import { ApiProperty } from '@nestjs/swagger';

/** Tonnage soulevé: weight × reps (× 2 for dumbbells) of the done sets of finished sessions, bodyweight ignored. */
export class TonnageDto {
  @ApiProperty({ example: 48600, description: 'kg, all time' })
  totalKg: number;

  @ApiProperty({ example: 2400, description: 'kg, sessions of the current week (Monday → Monday, Europe/Paris)' })
  weekKg: number;
}
