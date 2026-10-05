import { normalizeNutrients, searchKey, searchTerms } from '@healthmanager/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { toNutrients } from '../common/decimal.js';
import type { Food } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateFoodDto } from './dto/create-food.dto.js';
import { FoodDto, FoodUnitDto } from './dto/food.dto.js';

export const FOOD_SEARCH_LIMIT = 30;
/** Candidates fetched before ranking (CIQUAL has ~3 200 foods). */
const CANDIDATES = 300;

function parseUnits(units: unknown): FoodUnitDto[] {
  if (!Array.isArray(units)) return [];
  return units.filter(
    (u): u is FoodUnitDto =>
      typeof u === 'object' && u !== null && typeof u.label === 'string' && typeof u.grams === 'number',
  );
}

export function toFoodDto(food: Food): FoodDto {
  return {
    id: food.id,
    name: food.name,
    brand: food.brand,
    source: food.source,
    per100g: toNutrients(food),
    units: parseUnits(food.units),
  };
}

/**
 * Search ranking: my own foods first, then names starting with the query,
 * then names where a word starts with the first term, then shorter (more generic) names.
 */
export function rankFoods<F extends Pick<Food, 'source' | 'searchName'>>(foods: F[], query: string): F[] {
  const key = searchKey(query);
  const first = searchTerms(query)[0] ?? '';
  const score = (f: F) =>
    (f.source === 'ciqual' ? 0 : 4) +
    (f.searchName.startsWith(key) ? 2 : 0) +
    (f.searchName.startsWith(first) || f.searchName.includes(` ${first}`) ? 1 : 0);
  return [...foods].sort(
    (a, b) => score(b) - score(a) || a.searchName.length - b.searchName.length || a.searchName.localeCompare(b.searchName),
  );
}

@Injectable()
export class FoodsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Accent/case-insensitive search on every word; empty query → my own foods, latest first. */
  async search(query: string): Promise<FoodDto[]> {
    const terms = searchTerms(query);
    if (terms.length === 0) {
      const own = await this.prisma.food.findMany({
        where: { source: { not: 'ciqual' } },
        orderBy: { updatedAt: 'desc' },
        take: FOOD_SEARCH_LIMIT,
      });
      return own.map(toFoodDto);
    }
    const candidates = await this.prisma.food.findMany({
      where: { AND: terms.map((term) => ({ searchName: { contains: term } })) },
      take: CANDIDATES,
    });
    return rankFoods(candidates, query).slice(0, FOOD_SEARCH_LIMIT).map(toFoodDto);
  }

  async get(id: string): Promise<FoodDto> {
    const food = await this.prisma.food.findUnique({ where: { id } });
    if (!food) throw new NotFoundException('Food not found');
    return toFoodDto(food);
  }

  async create(dto: CreateFoodDto): Promise<FoodDto> {
    const name = dto.name.trim();
    const food = await this.prisma.food.create({
      data: {
        name,
        searchName: searchKey(name),
        brand: dto.brand?.trim() || null,
        source: 'custom',
        ...normalizeNutrients(dto.per100g),
        units: (dto.units ?? []).map((u) => ({ label: u.label.trim(), grams: u.grams })),
      },
    });
    return toFoodDto(food);
  }
}
