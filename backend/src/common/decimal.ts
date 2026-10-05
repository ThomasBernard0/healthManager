import type { Nutrients } from '@healthmanager/shared';
import { Prisma } from '../generated/prisma/client.js';

/** Prisma Decimal → number, for DTOs. */
export function num(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

type DecimalNutrients = {
  kcal: number;
  protein: Prisma.Decimal | number;
  carbs: Prisma.Decimal | number;
  fat: Prisma.Decimal | number;
};

/** A row with kcal/protein/carbs/fat columns → Nutrients. */
export function toNutrients(row: DecimalNutrients): Nutrients {
  return { kcal: row.kcal, protein: num(row.protein), carbs: num(row.carbs), fat: num(row.fat) };
}

/** Nullable column group (manualKcal, manualProtein, …) → Nutrients, or null if not set. */
export function optionalNutrients(
  kcal: number | null,
  protein: Prisma.Decimal | null,
  carbs: Prisma.Decimal | null,
  fat: Prisma.Decimal | null,
): Nutrients | null {
  if (kcal === null || protein === null || carbs === null || fat === null) return null;
  return toNutrients({ kcal, protein, carbs, fat });
}
