import {
  FINANCE_CATEGORIES,
  FINANCE_KINDS,
  type FinanceCategory,
  type FinanceKind,
} from '@healthmanager/shared';
import { ApiProperty } from '@nestjs/swagger';

/** One line of the typical month. */
export class FinanceLineDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: FINANCE_KINDS, enumName: 'FinanceKind' })
  kind: FinanceKind;

  @ApiProperty({ example: 'Loyer' })
  name: string;

  @ApiProperty({ example: 85000, description: 'Monthly amount, in cents' })
  amountCents: number;

  @ApiProperty({
    enum: FINANCE_CATEGORIES,
    enumName: 'FinanceCategory',
    nullable: true,
    description: 'Set for an expense, null for an income',
  })
  category: FinanceCategory | null;
}
