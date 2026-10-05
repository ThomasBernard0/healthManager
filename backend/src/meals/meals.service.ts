import {
  fromUtcDate,
  ingredientNutrients,
  matchesSearch,
  mealTotals,
  normalizeNutrients,
  type Nutrients,
  roundMacro,
  searchKey,
} from '@healthmanager/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { num, optionalNutrients, toNutrients } from '../common/decimal.js';
import { toFoodDto } from '../foods/foods.service.js';
import type { Food, Meal, MealItem } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MealDto, MealSummaryDto } from './dto/meal.dto.js';
import { SaveMealDto, UpdateMealFlagsDto } from './dto/save-meal.dto.js';

type MealWithItems = Meal & { items: (MealItem & { food: Food })[] };

interface MealStats {
  timesEaten: number;
  lastEatenOn: string | null;
}

const WITH_ITEMS = { items: { include: { food: true }, orderBy: { position: 'asc' } } } as const;
const NO_STATS: MealStats = { timesEaten: 0, lastEatenOn: null };

/** Mes repas order: favourites first, then most eaten, then most recently eaten, then by name. */
export function compareMeals(a: MealSummaryDto, b: MealSummaryDto): number {
  return (
    Number(b.isFavorite) - Number(a.isFavorite) ||
    b.timesEaten - a.timesEaten ||
    (b.lastEatenOn ?? '').localeCompare(a.lastEatenOn ?? '') ||
    a.name.localeCompare(b.name, 'fr')
  );
}

const manualTotalsOf = (m: Meal) =>
  optionalNutrients(m.manualKcal, m.manualProtein, m.manualCarbs, m.manualFat);
const overrideOf = (m: Meal) =>
  optionalNutrients(m.overrideKcal, m.overrideProtein, m.overrideCarbs, m.overrideFat);

/** One portion of a meal, with which totals are in use. */
export function totalsOf(meal: MealWithItems) {
  return mealTotals({
    mode: meal.mode,
    items: meal.items.map((i) => ({ per100g: toNutrients(i.food), grams: num(i.grams) })),
    manualTotals: manualTotalsOf(meal),
    override: overrideOf(meal),
  });
}

function toSummary(meal: MealWithItems, stats: MealStats): MealSummaryDto {
  const { totals, source } = totalsOf(meal);
  return {
    id: meal.id,
    name: meal.name,
    mode: meal.mode,
    isFavorite: meal.isFavorite,
    archived: meal.archived,
    totals,
    totalsSource: source,
    ...stats,
  };
}

function toMealDto(meal: MealWithItems, stats: MealStats): MealDto {
  return {
    ...toSummary(meal, stats),
    items: meal.items.map((item) => ({
      id: item.id,
      food: toFoodDto(item.food),
      grams: num(item.grams),
      unitLabel: item.unitLabel,
      unitCount: item.unitCount === null ? null : num(item.unitCount),
      nutrients: ingredientNutrients(toNutrients(item.food), num(item.grams)),
    })),
    manualTotals: manualTotalsOf(meal),
    override: overrideOf(meal),
  };
}

/** Nutrients → the four nullable columns of a group (manual*, override*). */
function columns(prefix: 'manual' | 'override', n: Nutrients | null | undefined) {
  const v = n ? normalizeNutrients(n) : null;
  return {
    [`${prefix}Kcal`]: v?.kcal ?? null,
    [`${prefix}Protein`]: v?.protein ?? null,
    [`${prefix}Carbs`]: v?.carbs ?? null,
    [`${prefix}Fat`]: v?.fat ?? null,
  };
}

@Injectable()
export class MealsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mes repas: one list, filtered by name (accent/case-insensitive, anywhere), sorted for quick logging. */
  async list(query = '', archived = false): Promise<MealSummaryDto[]> {
    const meals = await this.prisma.meal.findMany({ where: { archived }, include: WITH_ITEMS });
    const matching = meals.filter((m) => matchesSearch(m.searchName, query));
    const stats = await this.stats(matching.map((m) => m.id));
    return matching.map((m) => toSummary(m, stats.get(m.id) ?? NO_STATS)).sort(compareMeals);
  }

  async get(id: string): Promise<MealDto> {
    const meal = await this.getOrThrow(id);
    const stats = await this.stats([id]);
    return toMealDto(meal, stats.get(id) ?? NO_STATS);
  }

  async create(dto: SaveMealDto): Promise<MealDto> {
    await this.validate(dto);
    const meal = await this.prisma.meal.create({
      data: { ...this.mealData(dto), items: { create: this.itemsData(dto) } },
      include: WITH_ITEMS,
    });
    return toMealDto(meal, NO_STATS);
  }

  /** Replaces a saved meal. Past log entries keep their snapshot, so earlier days do not change. */
  async update(id: string, dto: SaveMealDto): Promise<MealDto> {
    await this.getOrThrow(id);
    await this.validate(dto);
    await this.prisma.$transaction([
      this.prisma.mealItem.deleteMany({ where: { mealId: id } }),
      this.prisma.meal.update({
        where: { id },
        data: { ...this.mealData(dto), items: { create: this.itemsData(dto) } },
      }),
    ]);
    return this.get(id);
  }

  async setFlags(id: string, dto: UpdateMealFlagsDto): Promise<MealSummaryDto> {
    await this.getOrThrow(id);
    const meal = await this.prisma.meal.update({
      where: { id },
      data: { isFavorite: dto.isFavorite, archived: dto.archived },
      include: WITH_ITEMS,
    });
    const stats = await this.stats([id]);
    return toSummary(meal, stats.get(id) ?? NO_STATS);
  }

  /** What logging one portion of this meal records (name + totals at that moment). */
  async snapshot(id: string): Promise<{ name: string; totals: Nutrients }> {
    const meal = await this.getOrThrow(id);
    return { name: meal.name, totals: totalsOf(meal).totals };
  }

  private async getOrThrow(id: string): Promise<MealWithItems> {
    const meal = await this.prisma.meal.findUnique({ where: { id }, include: WITH_ITEMS });
    if (!meal) throw new NotFoundException('Meal not found');
    return meal;
  }

  /** timesEaten / lastEatenOn derived from the log, so they never drift. */
  private async stats(ids: string[]): Promise<Map<string, MealStats>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.logEntry.groupBy({
      by: ['mealId'],
      where: { mealId: { in: ids } },
      _count: { _all: true },
      _max: { date: true },
    });
    return new Map(
      rows
        .filter((r) => r.mealId !== null)
        .map((r) => [
          r.mealId as string,
          { timesEaten: r._count._all, lastEatenOn: r._max.date ? fromUtcDate(r._max.date) : null },
        ]),
    );
  }

  private async validate(dto: SaveMealDto): Promise<void> {
    if (dto.mode === 'manual' && !dto.manualTotals) {
      throw new BadRequestException('manualTotals is required in manual mode');
    }
    if (dto.mode === 'ingredients') {
      if (dto.items.length === 0) throw new BadRequestException('items must not be empty in ingredients mode');
      const ids = [...new Set(dto.items.map((i) => i.foodId))];
      const found = await this.prisma.food.count({ where: { id: { in: ids } } });
      if (found !== ids.length) throw new BadRequestException('Unknown food in items');
    }
  }

  private mealData(dto: SaveMealDto) {
    const name = dto.name.trim();
    return {
      name,
      searchName: searchKey(name),
      mode: dto.mode,
      isFavorite: dto.isFavorite,
      ...columns('manual', dto.mode === 'manual' ? dto.manualTotals : null),
      ...columns('override', dto.override),
    };
  }

  private itemsData(dto: SaveMealDto) {
    if (dto.mode !== 'ingredients') return [];
    return dto.items.map((item, position) => ({
      foodId: item.foodId,
      grams: roundMacro(item.grams),
      unitLabel: item.unitLabel ?? null,
      unitCount: item.unitCount ?? null,
      position,
    }));
  }
}
