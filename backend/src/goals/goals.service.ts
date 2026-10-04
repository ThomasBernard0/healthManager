import {
  fromUtcDate,
  goalForDate,
  parisToday,
  roundMacro,
  toUtcDate,
} from '@healthmanager/shared';
import { Injectable } from '@nestjs/common';
import { num } from '../common/decimal.js';
import type { Goal } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CurrentGoalDto, GoalDto } from './dto/goal.dto.js';
import { UpdateGoalDto } from './dto/update-goal.dto.js';

export function toGoalDto(goal: Goal): GoalDto {
  return {
    id: goal.id,
    validFrom: fromUtcDate(goal.validFrom),
    dailyKcal: goal.dailyKcal,
    protein: num(goal.protein),
    carbs: num(goal.carbs),
    fat: num(goal.fat),
  };
}

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every goal version, oldest first. */
  async findAll(): Promise<GoalDto[]> {
    const goals = await this.prisma.goal.findMany({ orderBy: { validFrom: 'asc' } });
    return goals.map(toGoalDto);
  }

  async current(): Promise<CurrentGoalDto> {
    const today = parisToday();
    return { today, goal: goalForDate(await this.findAll(), today) };
  }

  /**
   * Takes effect immediately: a version valid from today (Paris).
   * Saving again the same day replaces that version; past days keep theirs.
   */
  async update(dto: UpdateGoalDto): Promise<GoalDto> {
    const validFrom = toUtcDate(parisToday());
    const data = {
      dailyKcal: dto.dailyKcal,
      protein: roundMacro(dto.protein),
      carbs: roundMacro(dto.carbs),
      fat: roundMacro(dto.fat),
    };
    const goal = await this.prisma.goal.upsert({
      where: { validFrom },
      create: { validFrom, ...data },
      update: data,
    });
    return toGoalDto(goal);
  }
}
