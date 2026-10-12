import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** Nouveau programme / rename. */
export class SaveProgramDto {
  @ApiProperty({ example: 'Push Pull', minLength: 1, maxLength: 40 })
  @IsString()
  @Length(1, 40)
  name: string;
}
