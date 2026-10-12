import { ApiProperty } from '@nestjs/swagger';

/** 409 of DELETE /foods/:id: a saved meal still uses the food. */
export class FoodInUseDto {
  @ApiProperty({ example: 409 })
  statusCode: number;

  @ApiProperty({ example: 'A meal uses this food' })
  message: string;

  @ApiProperty({ example: 'Pâtes au thon', description: 'One of the meals using it (the first by name)' })
  mealName: string;
}
