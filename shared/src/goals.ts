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
