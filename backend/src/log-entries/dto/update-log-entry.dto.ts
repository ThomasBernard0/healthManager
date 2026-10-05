import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IsLocalDate, IsLocalTime } from '../../common/validators.js';

/** A logged entry can only be moved in time; its portions are set when it is logged. */
export class UpdateLogEntryDto {
  @ApiPropertyOptional({ example: '13:00' })
  @IsOptional()
  @IsLocalTime()
  time?: string;

  @ApiPropertyOptional({ example: '2026-10-03' })
  @IsOptional()
  @IsLocalDate()
  date?: string;
}
