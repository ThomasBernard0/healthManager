import { ApiProperty } from '@nestjs/swagger';
import { NutrientsDto } from '../../common/nutrients.dto.js';

export class FoodDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Riz blanc, cuit, non salé' })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  brand: string | null;

  @ApiProperty({ type: NutrientsDto, description: 'Per 100 g' })
  per100g: NutrientsDto;

  @ApiProperty({ type: Number, nullable: true, example: 40, description: 'Weight of one portion (g); null: dosed in grams only' })
  portionGrams: number | null;
}
