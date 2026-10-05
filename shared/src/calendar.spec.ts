import {
  addDays,
  earliestDate,
  isIsoDate,
  parisNowTime,
  parisToday,
  weekDays,
  weekStart,
} from './calendar.js';

describe('Paris clock', () => {
  it('uses Paris local date and time, not UTC', () => {
    // 2026-10-04 22:30 UTC = Monday 2026-10-05 00:30 in Paris (CEST, UTC+2)
    const instant = new Date('2026-10-04T22:30:00Z');
    expect(parisToday(instant)).toBe('2026-10-05');
    expect(parisNowTime(instant)).toBe('00:30');
  });

  it('follows winter time', () => {
    // 2026-12-31 23:30 UTC = 2027-01-01 00:30 in Paris (CET, UTC+1)
    expect(parisToday(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });
});

describe('weeks', () => {
  it('start on Monday', () => {
    expect(weekStart('2026-10-04')).toBe('2026-09-28'); // Sunday → previous Monday
    expect(weekStart('2026-09-28')).toBe('2026-09-28'); // Monday → itself
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
  });

  it('put Sunday 23:30 in that week and Monday 00:10 in the next one', () => {
    const sunday = parisToday(new Date('2026-10-04T21:30:00Z')); // 23:30 Paris
    const monday = parisToday(new Date('2026-10-04T22:10:00Z')); // 00:10 Paris
    expect(weekStart(sunday)).toBe('2026-09-28');
    expect(weekStart(monday)).toBe('2026-10-05');
  });

  it('list 7 days across a DST change', () => {
    expect(weekDays('2026-10-19')).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25', // clocks go back this Sunday
    ]);
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });
});

describe('earliestDate', () => {
  it('is the first day with data, else today', () => {
    expect(earliestDate('2026-01-15', '2026-10-05')).toBe('2026-01-15');
    expect(earliestDate(null, '2026-10-05')).toBe('2026-10-05');
    // Only future days logged: today is still reachable.
    expect(earliestDate('2026-10-08', '2026-10-05')).toBe('2026-10-05');
  });
});

describe('isIsoDate', () => {
  it('accepts real dates only', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-2-3')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
  });
});
