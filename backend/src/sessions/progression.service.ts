import {
  DEFAULT_STEP,
  parisToday,
  sessionPreFatigue,
  targetsFromHistory,
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

const toTimes = (e: SessionEntry) => ({
  id: e.id,
  firstSetAt: e.firstSetAt?.getTime() ?? null,
  exercise: e.exercise,
  sets: e.sets.map((s) => ({ done: s.done, doneAt: s.doneAt?.getTime() ?? null })),
});

/**
 * Pre-fatigue of an exercise in its session: sets of the other exercises validated before its first set
 * (all of them while it is not started).
 */
export function entryPreFatigue(entry: SessionEntry, entries: SessionEntry[]): PreFatigue {
  return sessionPreFatigue(toTimes(entry), entries.map(toTimes));
}

/** A past session of an exercise, with its Europe/Paris date. */
export type DatedLog = ExerciseLog & { date: string };

export interface TargetsQuery {
  exerciseId: string;
  equipment: Equipment;
  setCount: number;
  repMin: number;
  repMax: number;
}

/** Next targets from the history of an exercise (no stored table: computed from its sessions). */
@Injectable()
export class ProgressionService {
  constructor(private readonly prisma: PrismaService) {}

  async targets(query: TargetsQuery): Promise<Target[] | null> {
    const [history, known] = await Promise.all([this.history(query.exerciseId), this.knownWeights(query.exerciseId)]);
    return targetsFromHistory(history, {
      setCount: query.setCount,
      repMin: query.repMin,
      repMax: query.repMax,
      known,
      step: DEFAULT_STEP[query.equipment],
    });
  }

  /** The last two finished sessions with this exercise, most recent first (skipped ones were dropped: they don't count). */
  async history(exerciseId: string): Promise<DatedLog[]> {
    const where: Prisma.SessionExerciseWhereInput = {
      exerciseId,
      session: { finishedAt: { not: null } },
      sets: { some: { done: true } },
    };
    const entries = await this.prisma.sessionExercise.findMany({
      where,
      orderBy: { session: { finishedAt: 'desc' } },
      take: 2,
      // Every set: the ones not done tell an exercise stopped early.
      include: { session: { select: { finishedAt: true } }, sets: { orderBy: { index: 'asc' } } },
    });
    return entries.map((e) => ({
      date: parisToday(e.session.finishedAt!),
      easy: e.easy,
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
