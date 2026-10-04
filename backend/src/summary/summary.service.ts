import {
  addDays,
  dailyTarget,
  goalForDate,
  parisToday,
  subtractNutrients,
  sumNutrients,
  toUtcDate,
  weekStart,
  weekTarget,
} from '@healthmanager/shared';
import { Injectable } from '@nestjs/common';
import { GoalsService } from '../goals/goals.service.js';
import { toLogEntryDto } from '../log-entries/log-entries.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DaySummaryDto } from './dto/day-summary.dto.js';

@Injectable()
export class SummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly goals: GoalsService,
  ) {}

  async day(date: string): Promise<DaySummaryDto> {
    const monday = weekStart(date);
    const [goals, weekRows] = await Promise.all([
      this.goals.findAll(),
      this.prisma.logEntry.findMany({
        where: { date: { gte: toUtcDate(monday), lte: toUtcDate(addDays(monday, 6)) } },
        orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    const weekEntries = weekRows.map(toLogEntryDto);
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
}
