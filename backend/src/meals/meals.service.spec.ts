import { searchKey, toUtcDate } from '@healthmanager/shared';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { MealsService } from './meals.service.js';

const D = (n: number) => new Prisma.Decimal(n);

const food = (id: string, kcal: number, protein: number, carbs: number, fat: number) => ({
  id,
  name: id,
  searchName: id,
  brand: null,
  source: 'ciqual' as const,
  ciqualCode: null,
  barcode: null,
  kcal,
  protein: D(protein),
  carbs: D(carbs),
  fat: D(fat),
  units: null,
  updatedAt: new Date(),
});

const pasta = food('pates', 158, 5.8, 30.5, 0.9);
const tuna = food('thon', 110, 23.3, 0, 1.2);

function meal(id: string, name: string, extra: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    name,
    searchName: searchKey(name),
    mode: 'manual' as const,
    manualKcal: 500,
    manualProtein: D(30),
    manualCarbs: D(50),
    manualFat: D(20),
    overrideKcal: null,
    overrideProtein: null,
    overrideCarbs: null,
    overrideFat: null,
    isFavorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    ...extra,
  };
}

describe('MealsService', () => {
  const prisma = {
    meal: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    mealItem: { deleteMany: vi.fn() },
    logEntry: { groupBy: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    food: { count: vi.fn() },
    $transaction: vi.fn(),
  };
  const service = new MealsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.logEntry.groupBy.mockResolvedValue([]);
  });

  it('lists Mes repas: favourites, then most eaten, then most recent', async () => {
    prisma.meal.findMany.mockResolvedValue([
      meal('a', 'Pâtes au pesto'),
      meal('b', 'Bol yaourt grec'),
      meal('c', 'Fajitas poulet', { isFavorite: true }),
      meal('d', 'Pomme'),
      meal('e', 'Jamais mangé'),
    ]);
    prisma.logEntry.groupBy.mockResolvedValue([
      { mealId: 'a', _count: { _all: 2 }, _max: { date: toUtcDate('2026-09-28') } },
      { mealId: 'b', _count: { _all: 5 }, _max: { date: toUtcDate('2026-10-04') } },
      { mealId: 'c', _count: { _all: 1 }, _max: { date: toUtcDate('2026-10-03') } },
      { mealId: 'd', _count: { _all: 2 }, _max: { date: toUtcDate('2026-10-02') } },
    ]);

    const list = await service.list();
    expect(list.map((m) => m.name)).toEqual([
      'Fajitas poulet',
      'Bol yaourt grec',
      'Pomme',
      'Pâtes au pesto',
      'Jamais mangé',
    ]);
    expect(list[1]).toMatchObject({ timesEaten: 5, lastEatenOn: '2026-10-04' });
    expect(list[4]).toMatchObject({ timesEaten: 0, lastEatenOn: null });
  });

  it('searches accent- and case-insensitively anywhere in the name', async () => {
    prisma.meal.findMany.mockResolvedValue([meal('a', 'Pâtes au pesto'), meal('c', 'Fajitas poulet')]);
    expect((await service.list('fajit')).map((m) => m.name)).toEqual(['Fajitas poulet']);
    expect((await service.list('PATES')).map((m) => m.name)).toEqual(['Pâtes au pesto']);
    expect(await service.list('boeuf')).toEqual([]);
  });

  it('sums ingredients, unless an override is set — and says which is used', async () => {
    const items = [
      { id: 'i1', mealId: 'm', foodId: 'pates', food: pasta, grams: D(220), unitLabel: null, unitCount: null, position: 0 },
      { id: 'i2', mealId: 'm', foodId: 'thon', food: tuna, grams: D(112), unitLabel: null, unitCount: null, position: 1 },
    ];
    prisma.meal.findUnique.mockResolvedValue(meal('m', 'Salade', { mode: 'ingredients', manualKcal: null, items }));
    const dto = await service.get('m');
    expect(dto.totalsSource).toBe('ingredients');
    expect(dto.totals).toEqual({ kcal: 471, protein: 38.9, carbs: 67.1, fat: 3.3 });
    expect(dto.items.map((i) => i.nutrients.kcal)).toEqual([348, 123]);

    prisma.meal.findUnique.mockResolvedValue(
      meal('m', 'Salade', {
        mode: 'ingredients',
        items,
        overrideKcal: 600,
        overrideProtein: D(40),
        overrideCarbs: D(70),
        overrideFat: D(16),
      }),
    );
    const overridden = await service.get('m');
    expect(overridden.totalsSource).toBe('override');
    expect(overridden.totals.kcal).toBe(600);
  });

  it('rejects manual mode without totals and ingredients mode without items', async () => {
    const base = { name: 'X', items: [], isFavorite: false };
    await expect(service.create({ ...base, mode: 'manual' })).rejects.toThrow(/manualTotals/);
    await expect(service.create({ ...base, mode: 'ingredients' })).rejects.toThrow(/items/);
  });

  it('editing a meal never touches past log entries', async () => {
    prisma.meal.findUnique.mockResolvedValue(meal('m', 'Pomme'));
    prisma.$transaction.mockResolvedValue([]);
    await service.update('m', {
      name: 'Pomme',
      mode: 'manual',
      items: [],
      manualTotals: { kcal: 120, protein: 0, carbs: 30, fat: 0 },
      isFavorite: false,
    });
    expect(prisma.logEntry.update).not.toHaveBeenCalled();
    expect(prisma.logEntry.updateMany).not.toHaveBeenCalled();
    expect(prisma.logEntry.create).not.toHaveBeenCalled();
  });
});
