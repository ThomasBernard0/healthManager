import {
  DEFAULT_STEP,
  nextTargets,
  preFatigue,
  type Equipment,
  type ExerciseLog,
  type Muscle,
  type PreFatigue,
  type Target,
} from '@healthmanager/shared';
import { Injectable } from '@nestjs/common';
import { num } from '../common/decimal.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** What the pre-fatigue of an exercise of a session is computed from. */
export interface SessionEntry {
  id: string;
  firstSetAt: Date | null;
  exercise: { primaryMuscles: Muscle[]; secondaryMuscles: Muscle[] };
  sets: { done: boolean; doneAt: Date | null }[];
}

/**
 * Pre-fatigue of an exercise in its session: sets of the other exercises validated before its first set
 * (all of them while it is not started).
 */
export function entryPreFatigue(entry: SessionEntry, entries: SessionEntry[]): PreFatigue {
  const cutoff = entry.firstSetAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return preFatigue(
    entry.exercise,
    entries
      .filter((other) => other.id !== entry.id)
      .map((other) => ({
        ...other.exercise,
        sets: other.sets.filter((s) => s.done && s.doneAt && s.doneAt.getTime() < cutoff).length,
      })),
  );
}

export interface TargetsQuery {
  exerciseId: string;
  equipment: Equipment;
  setCount: number;
  repMin: number;
  repMax: number;
  todayPreFatigue: number;
  /** The session the targets are for (not part of the history). */
  sessionId?: string;
}

/** Next targets from the history of an exercise (no stored table: computed from its sessions). */
@Injectable()
export class ProgressionService {
  constructor(private readonly prisma: PrismaService) {}

  async targets(query: TargetsQuery): Promise<Target[] | null> {
    const [history, known] = await Promise.all([
      this.history(query.exerciseId, query.sessionId),
      this.knownWeights(query.exerciseId),
    ]);
    return nextTargets({
      last: history[0] ?? null,
      previous: history[1] ?? null,
      setCount: query.setCount,
      repMin: query.repMin,
      repMax: query.repMax,
      known,
      step: DEFAULT_STEP[query.equipment],
      todayPreFatigue: query.todayPreFatigue,
    });
  }

  /** The last two finished sessions with this exercise (skipped ones were dropped: they don't count). */
  async history(exerciseId: string, excludeSessionId?: string): Promise<ExerciseLog[]> {
    const where: Prisma.SessionExerciseWhereInput = {
      exerciseId,
      session: { finishedAt: { not: null } },
      sets: { some: { done: true } },
      ...(excludeSessionId ? { sessionId: { not: excludeSessionId } } : {}),
    };
    const entries = await this.prisma.sessionExercise.findMany({
      where,
      orderBy: { session: { finishedAt: 'desc' } },
      take: 2,
      // Every set: the ones not done tell an exercise stopped early.
      include: { sets: { orderBy: { index: 'asc' } } },
    });
    return entries.map((e) => ({
      feeling: e.feeling,
      preFatigue: e.preFatigue === null ? 0 : num(e.preFatigue),
      complete: e.sets.every((s) => s.done),
      sets: e.sets
        .filter((s) => s.done)
        .map((s) => ({
          weight: num(s.weight!),
          reps: s.reps!,
          targetWeight: s.targetWeight === null ? null : num(s.targetWeight),
          targetReps: s.targetReps,
        })),
    }));
  }

  /** Distinct weights already logged for the exercise (fixing a typo removes the wrong one). */
  async knownWeights(exerciseId: string): Promise<number[]> {
    const rows = await this.prisma.sessionSet.findMany({
      where: { done: true, weight: { not: null }, sessionExercise: { exerciseId } },
      distinct: ['weight'],
      select: { weight: true },
    });
    return rows.map((r) => num(r.weight!));
  }
}
