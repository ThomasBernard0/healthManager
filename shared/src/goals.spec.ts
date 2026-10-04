import { weekDays } from './calendar.js';
import { goalForDate, weekDailyTargets, weekTarget } from './goals.js';
import { sumNutrients } from './nutrients.js';

const g2200 = { validFrom: '2026-01-01', dailyKcal: 2200, protein: 150, carbs: 230, fat: 70 };
const g2400 = { validFrom: '2026-09-30', dailyKcal: 2400, protein: 160, carbs: 250, fat: 80 };

describe('goalForDate', () => {
  it('takes the latest version valid on that date', () => {
    expect(goalForDate([g2200, g2400], '2026-09-29')).toBe(g2200);
    expect(goalForDate([g2200, g2400], '2026-09-30')).toBe(g2400);
    expect(goalForDate([g2400, g2200], '2027-01-01')).toBe(g2400);
  });

  it('uses the first goal for days before it, null without goals', () => {
    expect(goalForDate([g2400, g2200], '2025-06-01')).toBe(g2200);
    expect(goalForDate([], '2026-09-30')).toBeNull();
  });
});

describe('weekTarget', () => {
  it('raising 2 200 → 2 400 on Wednesday gives 2×2 200 + 5×2 400 = 16 400', () => {
    const monday = '2026-09-28';
    const daily = weekDailyTargets([g2200, g2400], monday).map((t) => t?.kcal);
    expect(daily).toEqual([2200, 2200, 2400, 2400, 2400, 2400, 2400]);
    expect(weekTarget([g2200, g2400], monday)?.kcal).toBe(16400);
  });

  it('is dailyKcal × 7 when the goal did not change that week', () => {
    expect(weekTarget([g2200], '2026-09-21')).toEqual({
      kcal: 15400,
      protein: 1050,
      carbs: 1610,
      fat: 490,
    });
  });

  it('equals the sum of its seven daily targets', () => {
    const monday = '2026-09-28';
    const daily = weekDailyTargets([g2200, g2400], monday);
    expect(daily).toHaveLength(weekDays(monday).length);
    expect(sumNutrients(daily.map((t) => t!))).toEqual(weekTarget([g2200, g2400], monday));
  });

  it('is null without goals', () => {
    expect(weekTarget([], '2026-09-28')).toBeNull();
  });
});
