import {
  entryNutrients,
  fromUtcDate,
  ingredientNutrients,
  normalizeNutrients,
  portionFromPer100g,
  type Nutrients,
  toUtcDate,
} from '@healthmanager/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { num, toNutrients } from '../common/decimal.js';
import type { LogEntry } from '../generated/prisma/client.js';
import { MealsService } from '../meals/meals.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateQuickEntryDto } from './dto/create-quick-entry.dto.js';
import { LogEntryDto } from './dto/log-entry.dto.js';
import { LogFoodDto } from './dto/log-food.dto.js';
import { LogMealDto } from './dto/log-meal.dto.js';
import { RestoreLogEntryDto } from './dto/restore-log-entry.dto.js';

export const entrySnapshot = (entry: LogEntry): Nutrients => toNutrients(entry);

export function toLogEntryDto(entry: LogEntry): LogEntryDto {
  const snapshot = entrySnapshot(entry);
  const quantity = num(entry.quantity);
  return {
    id: entry.id,
    date: fromUtcDate(entry.date),
    time: entry.time,
    kind: entry.kind,
    mealId: entry.mealId,
    foodId: entry.foodId,
    label: entry.label,
    quantity,
    grams: entry.grams === null ? null : num(entry.grams),
    snapshot,
    total: entryNutrients(snapshot, quantity),
  };
}

@Injectable()
export class LogEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meals: MealsService,
  ) {}

  /** Logs a saved meal; its totals are frozen, so editing the meal later never changes this day. */
  async logMeal(dto: LogMealDto): Promise<LogEntryDto> {
    const { name, totals } = await this.meals.snapshot(dto.mealId);
    const entry = await this.prisma.logEntry.create({
      data: {
        date: toUtcDate(dto.date),
        time: dto.time,
        kind: 'meal',
        mealId: dto.mealId,
        label: name,
        quantity: dto.quantity,
        ...totals,
      },
    });
    return toLogEntryDto(entry);
  }

  /**
   * Logs a food on its own (no meal), with its nutrients frozen like a meal's: in portions (the snapshot is
   * one portion, quantity the count) or in grams (the snapshot is those grams, quantity 1).
   */
  async logFood(dto: LogFoodDto): Promise<LogEntryDto> {
    if ((dto.portions === undefined) === (dto.grams === undefined)) {
      throw new BadRequestException('Exactly one of portions or grams');
    }
    const food = await this.prisma.food.findUnique({ where: { id: dto.foodId } });
    if (!food) throw new NotFoundException('Food not found');
    const per100g = toNutrients(food);
    let amount: { quantity: number; grams: number | null; snapshot: Nutrients };
    if (dto.portions !== undefined) {
      if (food.portionGrams === null) throw new BadRequestException('This food has no portion: log it in grams');
      amount = { quantity: dto.portions, grams: null, snapshot: portionFromPer100g(per100g, num(food.portionGrams)) };
    } else {
      amount = { quantity: 1, grams: dto.grams as number, snapshot: ingredientNutrients(per100g, dto.grams as number) };
    }
    const entry = await this.prisma.logEntry.create({
      data: {
        date: toUtcDate(dto.date),
        time: dto.time,
        kind: 'food',
        foodId: food.id,
        label: food.name,
        quantity: amount.quantity,
        grams: amount.grams,
        ...amount.snapshot,
      },
    });
    return toLogEntryDto(entry);
  }

  async createQuick(dto: CreateQuickEntryDto): Promise<LogEntryDto> {
    const entry = await this.prisma.logEntry.create({
      data: {
        date: toUtcDate(dto.date),
        time: dto.time,
        kind: 'quick',
        label: dto.label.trim(),
        quantity: 1,
        ...normalizeNutrients(dto),
      },
    });
    return toLogEntryDto(entry);
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.prisma.logEntry.delete({ where: { id } });
  }

  /** Undo of a delete: re-creates the entry (the meal or food link is dropped if it is gone). */
  async restore(dto: RestoreLogEntryDto): Promise<LogEntryDto> {
    const mealId =
      dto.mealId && (await this.prisma.meal.findUnique({ where: { id: dto.mealId } }))
        ? dto.mealId
        : null;
    const foodId =
      dto.foodId && (await this.prisma.food.findUnique({ where: { id: dto.foodId } }))
        ? dto.foodId
        : null;
    const entry = await this.prisma.logEntry.create({
      data: {
        date: toUtcDate(dto.date),
        time: dto.time,
        kind: dto.kind,
        mealId,
        foodId,
        label: dto.label.trim(),
        quantity: dto.quantity,
        grams: dto.grams ?? null,
        ...normalizeNutrients(dto.snapshot),
      },
    });
    return toLogEntryDto(entry);
  }

  private async getOrThrow(id: string): Promise<LogEntry> {
    const entry = await this.prisma.logEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Log entry not found');
    return entry;
  }
}
