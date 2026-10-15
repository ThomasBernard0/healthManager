import {
  FINANCE_AMOUNT_MAX_CENTS,
  FINANCE_CATEGORIES,
  FINANCE_KINDS,
  FINANCE_NAME_MAX,
  type FinanceCategory,
  type FinanceKind,
} from '@healthmanager/shared';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Ajouter. The service checks that an expense has a category and an income has none. */
export class CreateFinanceLineDto {
  @ApiProperty({ enum: FINANCE_KINDS, enumName: 'FinanceKind' })
  @IsIn(FINANCE_KINDS)
  kind: FinanceKind;

  @ApiProperty({
    example: 'Loyer',
    minLength: 1,
    maxLength: FINANCE_NAME_MAX,
    description: 'Trimmed',
  })
  @Transform(trim)
  @IsString()
  @Length(1, FINANCE_NAME_MAX)
  name: string;

  @ApiProperty({
    example: 85000,
    minimum: 1,
    maximum: FINANCE_AMOUNT_MAX_CENTS,
    description: 'Monthly, in cents',
  })
  @IsInt()
  @Min(1)
  @Max(FINANCE_AMOUNT_MAX_CENTS)
  amountCents: number;

  @ApiPropertyOptional({
    enum: FINANCE_CATEGORIES,
    enumName: 'FinanceCategory',
    nullable: true,
    description: 'Required for an expense; absent or null for an income',
  })
  @IsOptional()
  @IsIn(FINANCE_CATEGORIES)
  category?: FinanceCategory | null;
}

/** Modifier: only the fields sent change; the result must still be a valid line. */
export class UpdateFinanceLineDto extends PartialType(CreateFinanceLineDto) {}
