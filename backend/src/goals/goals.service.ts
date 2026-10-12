import {
  deriveCarbs,
  fromUtcDate,
  goalForDate,
  isGoalValid,
  parisToday,
  roundMacro,
  toUtcDate,
} from '@healthmanager/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
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
   * Carbs are derived from kcal, protein and fat; 400 when protein and fat exceed the kcal.
   */
  async update(dto: UpdateGoalDto): Promise<GoalDto> {
    const protein = roundMacro(dto.protein);
    const fat = roundMacro(dto.fat);
    if (!isGoalValid(dto.dailyKcal, protein, fat)) {
      throw new BadRequestException('protein and fat exceed dailyKcal');
    }
    const validFrom = toUtcDate(parisToday());
    const data = {
      dailyKcal: dto.dailyKcal,
      protein,
      carbs: deriveCarbs(dto.dailyKcal, protein, fat),
      fat,
    };
    const goal = await this.prisma.goal.upsert({
      where: { validFrom },
      create: { validFrom, ...data },
      update: data,
    });
    return toGoalDto(goal);
  }
}
