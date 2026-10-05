import { toUtcDate } from '@healthmanager/shared';
import { Prisma } from '../generated/prisma/client.js';
import type { GoalsService } from '../goals/goals.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { SummaryService } from './summary.service.js';

const D = (n: number) => new Prisma.Decimal(n);

let seq = 0;
const entry = (date: string, time: string, kcal: number, quantity = 1) => ({
  id: `e${++seq}`,
  date: toUtcDate(date),
  time,
  kind: 'quick' as const,
  mealId: null,
  label: 'Repas',
  quantity: D(quantity),
  kcal,
  protein: D(10.5),
  carbs: D(20),
  fat: D(5),
  createdAt: new Date(),
});

const goal = (validFrom: string, dailyKcal: number) => ({
  id: validFrom,
  validFrom,
  dailyKcal,
  protein: 150,
  carbs: 230,
  fat: 70,
});

describe('SummaryService.day', () => {
  const logEntry = { findMany: vi.fn(), findFirst: vi.fn() };
  const goals = { findAll: vi.fn() };
  const service = new SummaryService(
    { logEntry } as unknown as PrismaService,
    goals as unknown as GoalsService,
  );

  // Week of Monday 2026-09-28 → Sunday 2026-10-04; goal raised to 2 400 on Wednesday.
  const week = [
    entry('2026-09-28', '12:00', 2000),
    entry('2026-09-30', '08:10', 400),
    entry('2026-09-30', '12:45', 600, 2), // 2 portions → 1 200
    entry('2026-10-04', '23:30', 300), // Sunday late: still this week
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    goals.findAll.mockResolvedValue([
      goal('2026-01-01', 2200),
      goal('2026-09-30', 2400),
    ]);
    logEntry.findMany.mockResolvedValue(week);
    logEntry.findFirst.mockResolvedValue({ date: toUtcDate('2026-01-15') });
  });

  it('gives the earliest browsable date: the first day with data, else today', async () => {
    expect((await service.day('2026-09-30')).earliestDate).toBe('2026-01-15');
    logEntry.findFirst.mockResolvedValue(null);
    const day = await service.day('2026-09-30');
    expect(day.earliestDate).toBe(day.today);
  });

  it('queries the Monday→Sunday window of the date', async () => {
    await service.day('2026-09-30');
    expect(logEntry.findMany.mock.calls[0][0].where).toEqual({
      date: { gte: toUtcDate('2026-09-28'), lte: toUtcDate('2026-10-04') },
    });
  });

  it('computes the day: entries of that date, eaten, left against that day’s goal', async () => {
    const day = await service.day('2026-09-30');
    expect(day.entries.map((e) => e.total.kcal)).toEqual([400, 1200]);
    expect(day.eaten).toEqual({
      kcal: 1600,
      protein: 31.5,
      carbs: 60,
      fat: 15,
    });
    expect(day.goal?.dailyKcal).toBe(2400);
    expect(day.left).toEqual({
      kcal: 800,
      protein: 118.5,
      carbs: 170,
      fat: 55,
    });
  });

  it('keeps the old goal for days before the change', async () => {
    const day = await service.day('2026-09-28');
    expect(day.goal?.dailyKcal).toBe(2200);
    expect(day.left?.kcal).toBe(200);
  });

  it('computes the week: target 2×2 200 + 5×2 400 = 16 400, total = sum of the days', async () => {
    const { week: w } = await service.day('2026-10-04');
    expect(w.monday).toBe('2026-09-28');
    expect(w.target?.kcal).toBe(16400);
    expect(w.eaten.kcal).toBe(2000 + 400 + 1200 + 300);
    expect(w.left?.kcal).toBe(16400 - 3900);
  });

  it('reports negative left when over target', async () => {
    goals.findAll.mockResolvedValue([goal('2026-01-01', 1500)]);
    const day = await service.day('2026-09-30');
    expect(day.left?.kcal).toBe(-100);
  });

  it('has no target without any goal', async () => {
    goals.findAll.mockResolvedValue([]);
    const day = await service.day('2026-09-30');
    expect(day.goal).toBeNull();
    expect(day.left).toBeNull();
    expect(day.week.target).toBeNull();
  });
});

describe('SummaryService.week', () => {
  const logEntry = { findMany: vi.fn(), findFirst: vi.fn() };
  const goals = { findAll: vi.fn() };
  const service = new SummaryService(
    { logEntry } as unknown as PrismaService,
    goals as unknown as GoalsService,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    // Goal raised from 2 200 to 2 400 on Wednesday 2026-09-30.
    goals.findAll.mockResolvedValue([
      goal('2026-01-01', 2200),
      goal('2026-09-30', 2400),
    ]);
    logEntry.findMany.mockResolvedValue([
      entry('2026-09-28', '12:00', 2000),
      entry('2026-09-30', '08:10', 400),
      entry('2026-09-30', '12:45', 600, 2),
      entry('2026-10-04', '23:30', 300), // Sunday 23:30 counts in this week
    ]);
  });

  it('returns the 7 days Monday ? Sunday of any date of the week', async () => {
    const week = await service.week('2026-10-02');
    expect(week.monday).toBe('2026-09-28');
    expect(week.days.map((d) => d.date)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });

  it('compares each day with its own goal: Mon?Tue 2 200, Wed?Sun 2 400, week 16 400', async () => {
    const week = await service.week('2026-09-28');
    expect(week.days.map((d) => d.target?.kcal)).toEqual([
      2200, 2200, 2400, 2400, 2400, 2400, 2400,
    ]);
    expect(week.target?.kcal).toBe(16400);
    expect(week.days.map((d) => d.eaten.kcal)).toEqual([
      2000, 0, 1600, 0, 0, 0, 300,
    ]);
    expect(week.days[0].left?.kcal).toBe(200);
  });

  it('week total equals the sum of its seven days', async () => {
    const week = await service.week('2026-09-28');
    const sum = week.days.reduce((s, d) => s + d.eaten.kcal, 0);
    expect(week.eaten.kcal).toBe(sum);
    expect(week.eaten.protein).toBeCloseTo(
      week.days.reduce((s, d) => s + d.eaten.protein, 0),
      5,
    );
    expect(week.left?.kcal).toBe(16400 - 3900);
  });

  it('averages over the days elapsed (7 for a past week)', async () => {
    const week = await service.week('2026-09-28');
    expect(week.elapsedDays).toBe(7);
    expect(week.average.kcal).toBe(Math.round(3900 / 7));
  });
});
