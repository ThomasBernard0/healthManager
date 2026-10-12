import { weekDays } from './calendar.js';
import { sumNutrients, type Nutrients } from './nutrients.js';

/** A goal version: applies from `validFrom` until the next version. */
export interface GoalVersion {
  validFrom: string;
  dailyKcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Atwater factors: kcal per gram of each macro. */
export const KCAL_PER_GRAM = Object.freeze({ protein: 4, carbs: 4, fat: 9 });

/** Tenths, as an integer: grams are stored to 0.1 g, so the maths below stay exact. */
const tenths = (x: number): number => Math.round(x * 10);

/**
 * kcal of a goal not taken by protein and fat: what is left for carbs.
 * Negative = protein and fat alone exceed the kcal: the goal is invalid.
 */
export function carbsKcal(kcal: number, protein: number, fat: number): number {
  return (
    (tenths(kcal) -
      KCAL_PER_GRAM.protein * tenths(protein) -
      KCAL_PER_GRAM.fat * tenths(fat)) /
    10
  );
}

/** A goal is valid when protein and fat fit in its kcal. */
export function isGoalValid(kcal: number, protein: number, fat: number): boolean {
  return carbsKcal(kcal, protein, fat) >= 0;
}

/**
 * Carbs of a goal (whole grams) = round((kcal − 4 × protein − 9 × fat) / 4).
 * Negative (or 0) when the goal is invalid: check `isGoalValid`.
 */
export function deriveCarbs(kcal: number, protein: number, fat: number): number {
  return Math.round(carbsKcal(kcal, protein, fat) / KCAL_PER_GRAM.carbs) || 0;
}

/** kcal brought by each macro (4 / 4 / 9 per gram). */
export function macroKcal(macros: {
  protein: number;
  carbs: number;
  fat: number;
}): { protein: number; carbs: number; fat: number } {
  return {
    protein: KCAL_PER_GRAM.protein * macros.protein,
    carbs: KCAL_PER_GRAM.carbs * macros.carbs,
    fat: KCAL_PER_GRAM.fat * macros.fat,
  };
}

/**
 * The goal for a date = the version with the latest `validFrom` ≤ date.
 * Days before the first goal use the first goal; null only when no goal exists.
 */
export function goalForDate<G extends GoalVersion>(
  goals: readonly G[],
  date: string,
): G | null {
  let match: G | null = null;
  let earliest: G | null = null;
  for (const goal of goals) {
    if (!earliest || goal.validFrom < earliest.validFrom) earliest = goal;
    if (goal.validFrom <= date && (!match || goal.validFrom > match.validFrom)) {
      match = goal;
    }
  }
  return match ?? earliest;
}

export function dailyTarget(goal: GoalVersion): Nutrients {
  return {
    kcal: goal.dailyKcal,
    protein: goal.protein,
    carbs: goal.carbs,
    fat: goal.fat,
  };
}

/** Daily targets of each day of the week starting `monday` (null when no goal exists). */
export function weekDailyTargets(
  goals: readonly GoalVersion[],
  monday: string,
): (Nutrients | null)[] {
  return weekDays(monday).map((date) => {
    const goal = goalForDate(goals, date);
    return goal ? dailyTarget(goal) : null;
  });
}

/** Weekly target = sum of the daily target of each of its 7 days. */
export function weekTarget(
  goals: readonly GoalVersion[],
  monday: string,
): Nutrients | null {
  if (goals.length === 0) return null;
  return sumNutrients(
    weekDailyTargets(goals, monday).filter((t): t is Nutrients => t !== null),
  );
}
