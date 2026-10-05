import { averagePerDay, elapsedDays } from './week.js';

describe('elapsedDays', () => {
  const monday = '2026-09-28';
  it('counts started days of the week', () => {
    expect(elapsedDays(monday, '2026-09-27')).toBe(0);
    expect(elapsedDays(monday, '2026-09-28')).toBe(1);
    expect(elapsedDays(monday, '2026-09-30')).toBe(3);
    expect(elapsedDays(monday, '2026-10-04')).toBe(7);
    expect(elapsedDays(monday, '2026-12-01')).toBe(7);
  });
});

describe('averagePerDay', () => {
  it('divides the total by the number of days', () => {
    // design: 14 120 kcal over a full week → 2 017 / day
    expect(averagePerDay({ kcal: 14120, protein: 917, carbs: 1500, fat: 463 }, 7)).toEqual({
      kcal: 2017,
      protein: 131,
      carbs: 214.3,
      fat: 66.1,
    });
    expect(averagePerDay({ kcal: 100, protein: 1, carbs: 1, fat: 1 }, 0).kcal).toBe(0);
  });
});
