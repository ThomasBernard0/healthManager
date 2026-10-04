import { ApiProperty } from '@nestjs/swagger';
import { NutrientsDto } from '../../common/nutrients.dto.js';

export const LOG_KINDS = ['meal', 'quick'] as const;
export type LogKindValue = (typeof LOG_KINDS)[number];

export class LogEntryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '2026-10-04' })
  date: string;

  @ApiProperty({ example: '12:45' })
  time: string;

  @ApiProperty({ enum: LOG_KINDS, enumName: 'LogKind' })
  kind: LogKindValue;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Saved meal it was logged from' })
  mealId: string | null;

  @ApiProperty({ example: 'Bowl poulet riz' })
  label: string;

  @ApiProperty({ example: 1, description: 'Portions' })
  quantity: number;

  @ApiProperty({ type: NutrientsDto, description: 'Per portion, frozen at log time' })
  snapshot: NutrientsDto;

  @ApiProperty({ type: NutrientsDto, description: 'snapshot × quantity' })
  total: NutrientsDto;
}
