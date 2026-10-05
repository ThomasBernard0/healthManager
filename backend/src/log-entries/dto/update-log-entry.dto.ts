import { ApiProperty } from '@nestjs/swagger';
import { IsLocalTime } from '../../common/validators.js';

/** Only the time of a logged entry can change (it starts at the time it was logged). */
export class UpdateLogEntryDto {
  @ApiProperty({ example: '13:00' })
  @IsLocalTime()
  time: string;
}
