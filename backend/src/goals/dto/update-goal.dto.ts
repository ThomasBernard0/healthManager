import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class UpdateGoalDto {
  @ApiProperty({ example: 2400, minimum: 500, maximum: 10000 })
  @IsInt()
  @Min(500)
  @Max(10000)
  dailyKcal: number;

  @ApiProperty({ example: 160, minimum: 0, maximum: 1000 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1000)
  protein: number;

  @ApiProperty({ example: 250, minimum: 0, maximum: 1000 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1000)
  carbs: number;

  @ApiProperty({ example: 80, minimum: 0, maximum: 1000 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1000)
  fat: number;
}
