import { ApiProperty } from '@nestjs/swagger';
import { SetResultDto } from '../../common/set-result.dto.js';

const FEELINGS = ['easy', 'ok', 'hard'] as const;

/** One finished session of an exercise (Historique, Progression chart). */
export class ExerciseHistoryEntryDto {
  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty({ type: String, format: 'date', description: 'Europe/Paris date' })
  date: string;

  @ApiProperty({ type: [SetResultDto], description: 'Validated sets, in order' })
  sets: SetResultDto[];

  @ApiProperty({ enum: FEELINGS, enumName: 'Feeling', nullable: true })
  feeling: (typeof FEELINGS)[number] | null;

  @ApiProperty({ example: 0, description: 'Sets already done on its primary muscles (> 0: battery icon)' })
  preFatigue: number;

  @ApiProperty({ description: 'Done in a superset (link icon)' })
  inSuperset: boolean;

  @ApiProperty({ example: 2160, description: 'Σ weight × reps (kg)' })
  volume: number;

  @ApiProperty({ example: 60, description: 'Heaviest weight (kg)' })
  heaviest: number;
}
