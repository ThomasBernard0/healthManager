import { parisToday, setTonnage, weekStart } from '@healthmanager/shared';
import { Injectable } from '@nestjs/common';
import { num } from '../common/decimal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TonnageDto } from './dto/tonnage.dto.js';

@Injectable()
export class TonnageService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every non-bodyweight exercise, or only `exerciseId`; the week is the one of `now` (by session date). */
  async summary(exerciseId?: string, now = new Date()): Promise<TonnageDto> {
    const sets = await this.prisma.sessionSet.findMany({
      where: {
        done: true,
        weight: { not: null },
        reps: { not: null },
        sessionExercise: {
          ...(exerciseId ? { exerciseId } : {}),
          exercise: { equipment: { not: 'bodyweight' } },
          session: { finishedAt: { not: null } },
        },
      },
      select: {
        weight: true,
        reps: true,
        sessionExercise: { select: { exercise: { select: { equipment: true } }, session: { select: { finishedAt: true } } } },
      },
    });
    const monday = weekStart(parisToday(now));
    let totalKg = 0;
    let weekKg = 0;
    for (const s of sets) {
      const kg = setTonnage(num(s.weight!), s.reps!, s.sessionExercise.exercise.equipment);
      totalKg += kg;
      if (parisToday(s.sessionExercise.session.finishedAt!) >= monday) weekKg += kg;
    }
    return { totalKg, weekKg };
  }
}
