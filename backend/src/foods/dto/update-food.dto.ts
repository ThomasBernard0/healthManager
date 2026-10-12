import { OmitType } from '@nestjs/swagger';
import { CreateFoodDto } from './create-food.dto.js';

/** Modifier l'ingrédient: everything but the barcode. */
export class UpdateFoodDto extends OmitType(CreateFoodDto, ['barcode'] as const) {}
