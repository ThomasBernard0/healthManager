import {
  entryNutrients,
  fromUtcDate,
  normalizeNutrients,
  type Nutrients,
  toUtcDate,
} from '@healthmanager/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { num } from '../common/decimal.js';
import type { LogEntry } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateQuickEntryDto } from './dto/create-quick-entry.dto.js';
import { LogEntryDto } from './dto/log-entry.dto.js';
import { RestoreLogEntryDto } from './dto/restore-log-entry.dto.js';
import { DuplicateLogEntryDto, UpdateLogEntryDto } from './dto/update-log-entry.dto.js';

export function entrySnapshot(entry: LogEntry): Nutrients {
  return {
    kcal: entry.kcal,
    protein: num(entry.protein),
    carbs: num(entry.carbs),
    fat: num(entry.fat),
  };
}

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
  constructor(private readonly prisma: PrismaService) {}

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

  async update(id: string, dto: UpdateLogEntryDto): Promise<LogEntryDto> {
    await this.getOrThrow(id);
    const entry = await this.prisma.logEntry.update({
      where: { id },
      data: {
        quantity: dto.quantity,
        time: dto.time,
        date: dto.date ? toUtcDate(dto.date) : undefined,
      },
    });
    return toLogEntryDto(entry);
  }

  /** Copies an entry (same snapshot, quantity and meal) to another day. */
  async duplicate(id: string, dto: DuplicateLogEntryDto): Promise<LogEntryDto> {
    const source = await this.getOrThrow(id);
    const entry = await this.prisma.logEntry.create({
      data: {
        date: toUtcDate(dto.date),
        time: dto.time ?? source.time,
        kind: source.kind,
        mealId: source.mealId,
        label: source.label,
        quantity: source.quantity,
        ...entrySnapshot(source),
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
