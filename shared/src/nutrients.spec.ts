import {
  entryNutrients,
  ingredientNutrients,
  mealTotals,
  sumNutrients,
} from './nutrients.js';

const pasta = { kcal: 158, protein: 5.8, carbs: 30.5, fat: 0.9 };
const tuna = { kcal: 110, protein: 23.3, carbs: 0, fat: 1.2 };

describe('ingredientNutrients', () => {
  it('scales per-100 g values by grams', () => {
    expect(ingredientNutrients(pasta, 220)).toEqual({
      kcal: 348,
      protein: 12.8,
      carbs: 67.1,
      fat: 2,
    });
  });
});

describe('mealTotals', () => {
  const items = [
    { per100g: pasta, grams: 220 },
    { per100g: tuna, grams: 112 },
  ];

  it('sums the ingredients', () => {
    const { totals, source } = mealTotals({ mode: 'ingredients', items });
    expect(source).toBe('ingredients');
    expect(totals).toEqual({ kcal: 348 + 123, protein: 38.9, carbs: 67.1, fat: 3.3 });
  });

  it('uses the manual totals in manual mode', () => {
    const manualTotals = { kcal: 950, protein: 38, carbs: 110, fat: 38 };
    expect(mealTotals({ mode: 'manual', items: [], manualTotals })).toEqual({
      totals: manualTotals,
      source: 'manual',
    });
  });

  it('prefers the override over everything', () => {
    const override = { kcal: 600, protein: 40, carbs: 70, fat: 16 };
    expect(mealTotals({ mode: 'ingredients', items, override })).toEqual({
      totals: override,
      source: 'override',
    });
  });
});

describe('entryNutrients / sumNutrients', () => {
  it('multiplies a snapshot by its quantity and keeps storage precision', () => {
    expect(entryNutrients({ kcal: 250, protein: 30, carbs: 22.3, fat: 5 }, 0.5)).toEqual({
      kcal: 125,
      protein: 15,
      carbs: 11.2,
      fat: 2.5,
    });
  });

  it('adds macros without float drift', () => {
    const tenth = { kcal: 1, protein: 0.1, carbs: 0.2, fat: 0.3 };
    expect(sumNutrients(Array(10).fill(tenth))).toEqual({
      kcal: 10,
      protein: 1,
      carbs: 2,
      fat: 3,
    });
  });
});
