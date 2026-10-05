import {
  addDays,
  averagePerDay,
  dailyTarget,
  elapsedDays,
  goalForDate,
  parisToday,
  subtractNutrients,
  sumNutrients,
  toUtcDate,
  weekDays,
  weekStart,
  weekTarget,
} from '@healthmanager/shared';
import { Injectable } from '@nestjs/common';
import { GoalDto } from '../goals/dto/goal.dto.js';
import { GoalsService } from '../goals/goals.service.js';
import { LogEntryDto } from '../log-entries/dto/log-entry.dto.js';
import { toLogEntryDto } from '../log-entries/log-entries.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DaySummaryDto } from './dto/day-summary.dto.js';
import { WeekSummaryDto } from './dto/week-summary.dto.js';

/** A week = Monday 00:00 → next Monday 00:00 (Europe/Paris), i.e. the 7 local dates from Monday. */
@Injectable()
export class SummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly goals: GoalsService,
  ) {}

  async day(date: string): Promise<DaySummaryDto> {
    const { monday, goals, entries: weekEntries } = await this.loadWeek(date);
    const entries = weekEntries.filter((e) => e.date === date);

    const goal = goalForDate(goals, date);
    const eaten = sumNutrients(entries.map((e) => e.total));
    const weekEaten = sumNutrients(weekEntries.map((e) => e.total));
    const target = weekTarget(goals, monday);

    return {
      date,
      today: parisToday(),
      goal,
      eaten,
      left: goal ? subtractNutrients(dailyTarget(goal), eaten) : null,
      entries,
      week: {
        monday,
        eaten: weekEaten,
        target,
        left: target ? subtractNutrients(target, weekEaten) : null,
      },
    };
  }

  /** The week containing `date`: each day against its own goal, totals and averages. */
  async week(date: string): Promise<WeekSummaryDto> {
    const { monday, goals, entries } = await this.loadWeek(date);
    const today = parisToday();

    const days = weekDays(monday).map((day) => {
      const goal = goalForDate(goals, day);
      const eaten = sumNutrients(entries.filter((e) => e.date === day).map((e) => e.total));
      const target = goal ? dailyTarget(goal) : null;
      return { date: day, eaten, target, left: target ? subtractNutrients(target, eaten) : null };
    });
    // Week total = sum of its seven days.
    const eaten = sumNutrients(days.map((d) => d.eaten));
    const target = weekTarget(goals, monday);
    const elapsed = elapsedDays(monday, today);

    return {
      monday,
      today,
      days,
      eaten,
      target,
      left: target ? subtractNutrients(target, eaten) : null,
      elapsedDays: elapsed,
      average: averagePerDay(eaten, elapsed),
    };
  }

  private async loadWeek(
    date: string,
  ): Promise<{ monday: string; goals: GoalDto[]; entries: LogEntryDto[] }> {
    const monday = weekStart(date);
    const [goals, rows] = await Promise.all([
      this.goals.findAll(),
      this.prisma.logEntry.findMany({
        where: { date: { gte: toUtcDate(monday), lte: toUtcDate(addDays(monday, 6)) } },
        orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    return { monday, goals, entries: rows.map(toLogEntryDto) };
  }
}
