import { parisToday, toUtcDate } from '@healthmanager/shared';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { GoalsService } from './goals.service.js';

const row = (validFrom: string, dailyKcal: number) => ({
  id: validFrom,
  validFrom: toUtcDate(validFrom),
  dailyKcal,
  protein: new Prisma.Decimal(150),
  carbs: new Prisma.Decimal(230),
  fat: new Prisma.Decimal(70),
  createdAt: new Date(),
});

describe('GoalsService', () => {
  const goal = { findMany: vi.fn(), upsert: vi.fn() };
  const service = new GoalsService({ goal } as unknown as PrismaService);

  beforeEach(() => vi.resetAllMocks());

  it('saves a version valid from today, replacing today’s if any', async () => {
    const today = parisToday();
    goal.upsert.mockResolvedValue(row(today, 2400));

    const saved = await service.update({ dailyKcal: 2400, protein: 160.04, fat: 80 });

    const { where, create, update } = goal.upsert.mock.calls[0][0];
    expect(where).toEqual({ validFrom: toUtcDate(today) });
    expect(create).toEqual({ validFrom: toUtcDate(today), dailyKcal: 2400, protein: 160, carbs: 260, fat: 80 });
    expect(update).toEqual({ dailyKcal: 2400, protein: 160, carbs: 260, fat: 80 });
    expect(saved).toMatchObject({ validFrom: today, dailyKcal: 2400, protein: 150 });
  });

  it('derives the carbs from kcal, protein and fat', async () => {
    goal.upsert.mockResolvedValue(row(parisToday(), 2800));
    await service.update({ dailyKcal: 2800, protein: 150, fat: 70 });
    expect(goal.upsert.mock.calls[0][0].update).toEqual({ dailyKcal: 2800, protein: 150, carbs: 393, fat: 70 });
  });

  it('rejects a goal whose protein and fat exceed its kcal', async () => {
    await expect(service.update({ dailyKcal: 1500, protein: 200, fat: 100 })).rejects.toThrow(BadRequestException);
    expect(goal.upsert).not.toHaveBeenCalled();
  });

  it('returns the goal applying today', async () => {
    goal.findMany.mockResolvedValue([row('2026-01-01', 2200), row('2999-01-01', 9999)]);
    const { today, goal: current } = await service.current();
    expect(today).toBe(parisToday());
    expect(current?.dailyKcal).toBe(2200);
  });
});
