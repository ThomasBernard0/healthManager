import {
  entryNutrients,
  fromUtcDate,
  normalizeNutrients,
  type Nutrients,
  toUtcDate,
} from '@healthmanager/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { num, toNutrients } from '../common/decimal.js';
import type { LogEntry } from '../generated/prisma/client.js';
import { MealsService } from '../meals/meals.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateQuickEntryDto } from './dto/create-quick-entry.dto.js';
import { LogEntryDto } from './dto/log-entry.dto.js';
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
    label: entry.label,
    quantity,
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

  /** Undo of a delete: re-creates the entry (the meal link is dropped if the meal is gone). */
  async restore(dto: RestoreLogEntryDto): Promise<LogEntryDto> {
    const mealId =
      dto.mealId && (await this.prisma.meal.findUnique({ where: { id: dto.mealId } }))
        ? dto.mealId
        : null;
    const entry = await this.prisma.logEntry.create({
      data: {
        date: toUtcDate(dto.date),
        time: dto.time,
        kind: dto.kind,
        mealId,
        label: dto.label.trim(),
        quantity: dto.quantity,
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
