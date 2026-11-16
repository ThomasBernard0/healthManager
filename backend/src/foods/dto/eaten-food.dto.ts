import { ApiProperty } from '@nestjs/swagger';
import { FoodDto } from './food.dto.js';

/** A food logged on its own at least once: it joins Mes repas in Ajout rapide. */
export class EatenFoodDto {
  @ApiProperty({ type: FoodDto })
  food: FoodDto;

  @ApiProperty({ example: 4, description: 'Times logged on its own' })
  timesEaten: number;

  @ApiProperty({ type: String, nullable: true, example: '2026-10-04' })
  lastEatenOn: string | null;
}
