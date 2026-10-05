import { addDays } from './calendar.js';
import { scaleNutrients, ZERO_NUTRIENTS, type Nutrients } from './nutrients.js';

/**
 * Days of the week starting `monday` that have started by `today`:
 * 7 for a past week, 1–7 for the current week, 0 for a future week.
 */
export function elapsedDays(monday: string, today: string): number {
  if (today < monday) return 0;
  if (today > addDays(monday, 6)) return 7;
  let n = 1;
  while (addDays(monday, n) <= today) n++;
  return n;
}

/** Average per day over `days` days (zero when no day has started). */
export function averagePerDay(total: Nutrients, days: number): Nutrients {
  return days > 0 ? scaleNutrients(total, 1 / days) : ZERO_NUTRIENTS;
}
