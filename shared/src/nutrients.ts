/** kcal and the three macros. kcal are whole numbers, macros are grams to 0.1 g. */
export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const ZERO_NUTRIENTS: Nutrients = Object.freeze({
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
});

/** Math.round after dropping float noise (11.15 × 10 = 111.4999… must round to 112). */
const roundClean = (x: number): number => Math.round(Number(x.toPrecision(12))) || 0;

export const roundKcal = (kcal: number): number => roundClean(kcal);

/** Rounds grams to 0.1 g (the storage precision of macros). */
export const roundMacro = (grams: number): number => roundClean(grams * 10) / 10;

/** Brings any nutrient values back to storage precision. */
export function normalizeNutrients(n: Nutrients): Nutrients {
  return {
    kcal: roundKcal(n.kcal),
    protein: roundMacro(n.protein),
    carbs: roundMacro(n.carbs),
    fat: roundMacro(n.fat),
  };
}

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return normalizeNutrients({
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  });
}

export function subtractNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return normalizeNutrients({
    kcal: a.kcal - b.kcal,
    protein: a.protein - b.protein,
    carbs: a.carbs - b.carbs,
    fat: a.fat - b.fat,
  });
}

export function sumNutrients(list: readonly Nutrients[]): Nutrients {
  return list.reduce(addNutrients, ZERO_NUTRIENTS);
}

export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  return normalizeNutrients({
    kcal: n.kcal * factor,
    protein: n.protein * factor,
    carbs: n.carbs * factor,
    fat: n.fat * factor,
  });
}

/** Ingredient value = grams / 100 × per100g, for kcal and each macro. */
export function ingredientNutrients(per100g: Nutrients, grams: number): Nutrients {
  return scaleNutrients(per100g, grams / 100);
}

export type MealTotalsSource = 'override' | 'manual' | 'ingredients';

export interface MealTotalsInput {
  mode: 'ingredients' | 'manual';
  items: readonly { per100g: Nutrients; grams: number }[];
  manualTotals?: Nutrients | null;
  override?: Nutrients | null;
}

/**
 * Meal totals for one portion: the override if set, else the manual totals in manual mode,
 * else the sum of the ingredients (each ingredient rounded, so rows add up to the total).
 */
export function mealTotals(meal: MealTotalsInput): {
  totals: Nutrients;
  source: MealTotalsSource;
} {
  if (meal.override) {
    return { totals: normalizeNutrients(meal.override), source: 'override' };
  }
  if (meal.mode === 'manual') {
    return {
      totals: normalizeNutrients(meal.manualTotals ?? ZERO_NUTRIENTS),
      source: 'manual',
    };
  }
  return {
    totals: sumNutrients(
      meal.items.map((i) => ingredientNutrients(i.per100g, i.grams)),
    ),
    source: 'ingredients',
  };
}

/** What a log entry counts for: its per-portion snapshot × quantity. */
export function entryNutrients(snapshot: Nutrients, quantity: number): Nutrients {
  return scaleNutrients(snapshot, quantity);
}
