import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { NutrientsDto } from '../../common/nutrients.dto.js';
import { FoodUnitDto } from './food.dto.js';

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

  @ApiProperty({ type: NutrientsDto, description: 'Per 100 g' })
  @ValidateNested()
  @Type(() => NutrientsDto)
  per100g: NutrientsDto;

  @ApiPropertyOptional({ type: [FoodUnitDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => FoodUnitDto)
  units?: FoodUnitDto[];
}
