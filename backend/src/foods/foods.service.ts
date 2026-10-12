import { normalizeNutrients, searchKey, searchTerms } from '@healthmanager/shared';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { toNutrients } from '../common/decimal.js';
import type { Food } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BarcodeLookupDto } from './dto/barcode-lookup.dto.js';
import { CreateFoodDto } from './dto/create-food.dto.js';
import { FoodDto, FoodUnitDto } from './dto/food.dto.js';
import type { FoodInUseDto } from './dto/food-in-use.dto.js';
import { UpdateFoodDto } from './dto/update-food.dto.js';
import { OpenFoodFactsClient } from './open-food-facts.client.js';

/** Household unit added to scanned products that declare a serving size. */
const SERVING_LABEL = 'portion';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';

export const FOOD_SEARCH_LIMIT = 30;
/** Candidates fetched before ranking. */
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
    per100g: toNutrients(food),
    units: parseUnits(food.units),
  };
}

/** The editable columns of a food, as stored. */
function toData(dto: UpdateFoodDto) {
  const name = dto.name.trim();
  return {
    name,
    searchName: searchKey(name),
    brand: dto.brand?.trim() || null,
    ...normalizeNutrients(dto.per100g),
    units: (dto.units ?? []).map((u) => ({ label: u.label.trim(), grams: u.grams })),
  };
}

/**
 * Search ranking: names starting with the query, then names where a word starts with the first term,
 * then shorter (more generic) names.
 */
export function rankFoods<F extends Pick<Food, 'searchName'>>(foods: F[], query: string): F[] {
  const key = searchKey(query);
  const first = searchTerms(query)[0] ?? '';
  const score = (f: F) =>
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

  /** Accent/case-insensitive search on every word; empty query → latest first. */
  async search(query: string): Promise<FoodDto[]> {
    const terms = searchTerms(query);
    if (terms.length === 0) {
      const latest = await this.prisma.food.findMany({
        orderBy: { updatedAt: 'desc' },
        take: FOOD_SEARCH_LIMIT,
      });
      return latest.map(toFoodDto);
    }
    const candidates = await this.prisma.food.findMany({
      where: { AND: terms.map((term) => ({ searchName: { contains: term } })) },
      take: CANDIDATES,
    });
    return rankFoods(candidates, query).slice(0, FOOD_SEARCH_LIMIT).map(toFoodDto);
  }

  /** Every food, by name (Mes repas → Ingrédients). */
  async listAll(): Promise<FoodDto[]> {
    const foods = await this.prisma.food.findMany({ orderBy: { searchName: 'asc' } });
    return foods.map(toFoodDto);
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
    try {
      const food = await this.prisma.food.create({ data: { ...toData(dto), barcode: dto.barcode ?? null } });
      return toFoodDto(food);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A food already has this barcode');
      throw error;
    }
  }

  /** Saved meals using the food follow its new values; logged entries keep their snapshot. */
  async update(id: string, dto: UpdateFoodDto): Promise<FoodDto> {
    await this.get(id);
    return toFoodDto(await this.prisma.food.update({ where: { id }, data: toData(dto) }));
  }

  /** Refused while a saved meal uses the food: the answer names one of them. */
  async remove(id: string): Promise<void> {
    await this.get(id);
    const used = await this.prisma.mealItem.findFirst({
      where: { foodId: id },
      include: { meal: true },
      orderBy: { meal: { name: 'asc' } },
    });
    if (used) {
      const body: FoodInUseDto = { statusCode: 409, message: 'A meal uses this food', mealName: used.meal.name };
      throw new ConflictException(body);
    }
    await this.prisma.food.delete({ where: { id } });
  }
}
