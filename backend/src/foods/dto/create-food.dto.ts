import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { NutrientsDto } from '../../common/nutrients.dto.js';
import { IsBarcode } from '../../common/validators.js';

/** "Mon aliment": a food that is not in the database, created once and reused. */
export class CreateFoodDto {
  @ApiProperty({ example: 'Granola maison', minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiPropertyOptional({ example: 'Bjorg', maxLength: 80 })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  brand?: string;

  @ApiPropertyOptional({ example: '3017620422003', description: 'Scanned product missing from Open Food Facts' })
  @IsOptional()
  @IsBarcode()
  barcode?: string;

  @ApiProperty({ type: NutrientsDto, description: 'Per 100 g' })
  @ValidateNested()
  @Type(() => NutrientsDto)
  per100g: NutrientsDto;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 40,
    minimum: 0.1,
    maximum: 2000,
    description: 'Weight of one portion (g); left out or null: dosed in grams only',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 1 })
  @Min(0.1)
  @Max(2000)
  portionGrams?: number | null;
}
