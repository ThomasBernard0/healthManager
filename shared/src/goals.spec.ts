import { weekDays } from './calendar.js';
import {
  carbsKcal,
  deriveCarbs,
  goalForDate,
  isGoalValid,
  macroKcal,
  weekDailyTargets,
  weekTarget,
} from './goals.js';
import { entryNutrients, sumNutrients } from './nutrients.js';

const g2200 = { validFrom: '2026-01-01', dailyKcal: 2200, protein: 150, carbs: 243, fat: 70 };
const g2400 = { validFrom: '2026-09-30', dailyKcal: 2400, protein: 160, carbs: 260, fat: 80 };

// One test per acceptance check of docs/specs/goal-macros.md.
describe('deriveCarbs', () => {
  it('2 400 kcal, P 160, F 80 → carbs 260', () => {
    expect(deriveCarbs(2400, 160, 80)).toBe(260);
    expect(isGoalValid(2400, 160, 80)).toBe(true);
  });

  it('2 800 kcal, P 150, F 70 → carbs 393 (392.5 rounded)', () => {
    expect(deriveCarbs(2800, 150, 70)).toBe(393);
  });

  it('raising kcal by 50 raises carbs by 12–13 g', () => {
    for (let kcal = 2000; kcal < 3000; kcal += 50) {
      const delta = deriveCarbs(kcal + 50, 160, 80) - deriveCarbs(kcal, 160, 80);
      expect([12, 13]).toContain(delta);
    }
    expect(deriveCarbs(2450, 160, 80) - deriveCarbs(2400, 160, 80)).toBe(13);
    expect(deriveCarbs(2500, 160, 80) - deriveCarbs(2450, 160, 80)).toBe(12);
  });

  it('P +10 g lowers carbs by 10 g', () => {
    expect(deriveCarbs(2400, 170, 80)).toBe(deriveCarbs(2400, 160, 80) - 10);
    expect(deriveCarbs(2800, 160, 70)).toBe(deriveCarbs(2800, 150, 70) - 10);
  });

  it('F +10 g lowers carbs by 23 g (22.5 rounded), or 22 g when the half rounds the other way', () => {
    // 393 (392.5) → 370
    expect(deriveCarbs(2800, 150, 70) - deriveCarbs(2800, 150, 80)).toBe(23);
    // 260 → 238 (237.5)
    expect(deriveCarbs(2400, 160, 80) - deriveCarbs(2400, 160, 90)).toBe(22);
  });

  it('1 500 kcal, P 200, F 100 → invalid (−200 kcal left)', () => {
    expect(carbsKcal(1500, 200, 100)).toBe(-200);
    expect(isGoalValid(1500, 200, 100)).toBe(false);
    expect(deriveCarbs(1500, 200, 100)).toBe(-50);
  });

  it('is invalid as soon as a single kcal is missing, valid at exactly 0 g of carbs', () => {
    expect(isGoalValid(1539, 160, 100)).toBe(false);
    expect(deriveCarbs(1539, 160, 100)).toBe(0);
    expect(isGoalValid(1540, 160, 100)).toBe(true);
    expect(deriveCarbs(1540, 160, 100)).toBe(0);
  });

  it('stays exact with macros to 0.1 g', () => {
    // 2 400 − 4 × 150.1 − 9 × 70.1 = 1 168.7 kcal → 292.175 g
    expect(carbsKcal(2400, 150.1, 70.1)).toBe(1168.7);
    expect(deriveCarbs(2400, 150.1, 70.1)).toBe(292);
  });

  it('a meal logged as 500 kcal with P 30 / C 50 / F 15 (= 455 by 4/4/9) still counts 500 kcal', () => {
    const logged = { kcal: 500, protein: 30, carbs: 50, fat: 15 };
    const byMacros = macroKcal(logged);
    expect(byMacros.protein + byMacros.carbs + byMacros.fat).toBe(455);
    expect(entryNutrients(logged, 1).kcal).toBe(500);
    expect(sumNutrients([entryNutrients(logged, 1)]).kcal).toBe(500);
  });
});

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
      carbs: 1701,
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
