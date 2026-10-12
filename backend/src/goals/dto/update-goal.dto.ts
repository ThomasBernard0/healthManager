import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

/** Carbs are not sent: they are derived from kcal, protein and fat (4 / 4 / 9 kcal per gram). */
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

  @ApiProperty({ example: 80, minimum: 0, maximum: 1000 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1000)
  fat: number;
}
