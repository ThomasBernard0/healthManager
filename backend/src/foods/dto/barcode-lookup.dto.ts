import { ApiProperty } from '@nestjs/swagger';
import { FoodDto } from './food.dto.js';

/**
 * Result of a barcode scan: the food (already in the database, or just imported from Open Food Facts),
 * or null with the product name when it has to be created as "Mon aliment".
 */
export class BarcodeLookupDto {
  @ApiProperty({ type: FoodDto, nullable: true })
  food: FoodDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Product name when its values are missing',
  })
  suggestedName: string | null;
}
