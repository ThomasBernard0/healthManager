import { normalizeNutrients, searchKey, searchTerms } from '@healthmanager/shared';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { toNutrients } from '../common/decimal.js';
import type { Food } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BarcodeLookupDto } from './dto/barcode-lookup.dto.js';
import { CreateFoodDto } from './dto/create-food.dto.js';
import { FoodDto, FoodUnitDto } from './dto/food.dto.js';
import { OpenFoodFactsClient } from './open-food-facts.client.js';

/** Household unit added to scanned products that declare a serving size. */
const SERVING_LABEL = 'portion';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly off: OpenFoodFactsClient,
  ) {}

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

  /**
   * A scanned barcode (already validated): a food already known by that barcode, else the
   * Open Food Facts product saved once as a food. Products without usable values are not saved.
   */
  async lookupBarcode(barcode: string): Promise<BarcodeLookupDto> {
    const known = await this.prisma.food.findUnique({ where: { barcode } });
    if (known) return { food: toFoodDto(known), suggestedName: null };

    const product = await this.off.product(barcode);
    if (!product) return { food: null, suggestedName: null };
    if (!product.per100g || !product.name) return { food: null, suggestedName: product.name };

    try {
      const food = await this.prisma.food.create({
        data: {
          name: product.name,
          searchName: searchKey(product.name),
          brand: product.brand,
          source: 'off',
          barcode,
          ...product.per100g,
          units: product.servingGrams ? [{ label: SERVING_LABEL, grams: product.servingGrams }] : [],
        },
      });
      return { food: toFoodDto(food), suggestedName: null };
    } catch (error) {
      // Scanned twice at once: the other request saved it first.
      if (!isUniqueViolation(error)) throw error;
      const food = await this.prisma.food.findUniqueOrThrow({ where: { barcode } });
      return { food: toFoodDto(food), suggestedName: null };
    }
  }

  async create(dto: CreateFoodDto): Promise<FoodDto> {
    const name = dto.name.trim();
    try {
      const food = await this.prisma.food.create({
        data: {
          name,
          searchName: searchKey(name),
          brand: dto.brand?.trim() || null,
          source: 'custom',
          barcode: dto.barcode ?? null,
          ...normalizeNutrients(dto.per100g),
          units: (dto.units ?? []).map((u) => ({ label: u.label.trim(), grams: u.grams })),
        },
      });
      return toFoodDto(food);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A food already has this barcode');
      throw error;
    }
  }
}
