import { parisToday, type Equipment } from '@healthmanager/shared';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { num } from '../common/decimal.js';
import { EXERCISE_INCLUDE, toExerciseDto } from '../exercises/exercises.service.js';
import type { SessionSet } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { entryPreFatigue, ProgressionService } from './progression.service.js';
import { SaveSetDto, UpdateSessionExerciseDto } from './dto/save-session.dto.js';
import {
  CurrentSessionDto,
  ExerciseStatus,
  LastTimeDto,
  SessionDto,
  SessionExerciseDto,
  SessionSetDto,
} from './dto/session.dto.js';

const SETS = { sets: { orderBy: { index: 'asc' } } } as const;
const SESSION_INCLUDE = {
  exercises: { orderBy: { position: 'asc' }, include: { exercise: { include: EXERCISE_INCLUDE }, ...SETS } },
} as const;

const toSetDto = (s: SessionSet): SessionSetDto => ({
  index: s.index,
  targetWeight: s.targetWeight === null ? null : num(s.targetWeight),
  targetReps: s.targetReps,
  weight: s.weight === null ? null : num(s.weight),
  reps: s.reps,
  done: s.done,
});

function status(e: { completed: boolean; sets: { done: boolean }[] }): ExerciseStatus {
  if (e.completed) return 'done';
  return e.sets.some((s) => s.done) ? 'inProgress' : 'todo';
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progression: ProgressionService,
  ) {}

  async current(): Promise<CurrentSessionDto> {
    const open = await this.prisma.session.findFirst({ where: { finishedAt: null }, orderBy: { startedAt: 'desc' } });
    return { session: open ? await this.get(open.id) : null };
  }

  /**
   * Démarrer: one session at a time, workouts of the active program only; every exercise of the workout with its
   * sets (targets set on the first one).
   */
  async start(workoutId: string): Promise<SessionDto> {
    const open = await this.prisma.session.findFirst({ where: { finishedAt: null } });
    if (open) throw new ConflictException('A session is already in progress');
    const workout = await this.prisma.workout.findUnique({
      where: { id: workoutId },
      include: { items: { orderBy: { position: 'asc' } }, program: true },
    });
    if (!workout) throw new NotFoundException('Workout not found');
    if (!workout.program.active) throw new BadRequestException('The workout is not in the active program');
    if (workout.items.length === 0) throw new BadRequestException('The workout has no exercise');
    const session = await this.prisma.session.create({
      data: {
        workoutId: workout.id,
        workoutName: workout.name,
        exercises: {
          create: workout.items.map((item) => ({
            exerciseId: item.exerciseId,
            position: item.position,
            repMin: item.repMin,
            repMax: item.repMax,
            sets: { create: Array.from({ length: item.sets }, (_, index) => ({ index })) },
          })),
        },
      },
    });
    return this.get(session.id);
  }

  async get(id: string): Promise<SessionDto> {
    const session = await this.prisma.session.findUnique({ where: { id }, include: SESSION_INCLUDE });
    if (!session) throw new NotFoundException('Session not found');
    return {
      id: session.id,
      workoutId: session.workoutId,
      workoutName: session.workoutName,
      startedAt: session.startedAt.toISOString(),
      finishedAt: session.finishedAt?.toISOString() ?? null,
      exercises: session.exercises.map((e) => ({
        id: e.id,
        exercise: toExerciseDto(e.exercise),
        status: status(e),
        preFatigue: e.preFatigue === null ? entryPreFatigue(e, session.exercises).value : num(e.preFatigue),
      })),
    };
  }

  /**
   * Exercice en cours. Until its first set is validated, targets and pre-fatigue are computed live (the
   * order of the exercises can still change); then they are frozen with the sets.
   */
  async getExercise(sessionId: string, id: string): Promise<SessionExerciseDto> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId }, include: SESSION_INCLUDE });
    const entry = session?.exercises.find((e) => e.id === id);
    if (!session || !entry) throw new NotFoundException('Session exercise not found');
    const fatigue = entryPreFatigue(entry, session.exercises);
    const frozen = entry.preFatigue !== null;
    const live = frozen ? null : await this.targetsFor(sessionId, entry, fatigue.value);
    return {
      id: entry.id,
      sessionId: entry.sessionId,
      workoutName: session.workoutName,
      exercise: toExerciseDto(entry.exercise),
      repMin: entry.repMin,
      repMax: entry.repMax,
      feeling: entry.feeling,
      completed: entry.completed,
      sets: entry.sets.map((s, i) => ({
        ...toSetDto(s),
        ...(live ? { targetWeight: live[i]?.weight ?? null, targetReps: live[i]?.reps ?? null } : {}),
      })),
      preFatigue: frozen ? num(entry.preFatigue!) : fatigue.value,
      fatiguedMuscles: fatigue.muscles,
      lastTime: await this.lastTime(entry.exerciseId, entry.sessionId),
    };
  }

  /** ✓ on a set row (in order): empty values record the target; done = false reopens any row. */
  async saveSet(sessionId: string, id: string, index: number, dto: SaveSetDto): Promise<SessionExerciseDto> {
    let entry = await this.openEntry(sessionId, id);
    if (!entry.sets.some((s) => s.index === index)) throw new NotFoundException('Set not found');
    // New sets are validated in order; any done set can still be reopened.
    if (dto.done && entry.sets.some((s) => s.index < index && !s.done)) {
      throw new BadRequestException('Validate the sets in order');
    }
    if (entry.preFatigue === null) entry = await this.freeze(sessionId, id);
    const set = entry.sets.find((s) => s.index === index)!;

    const now = new Date();
    if (dto.done) {
      const weight = dto.weight ?? (set.targetWeight === null ? null : num(set.targetWeight));
      const reps = dto.reps ?? set.targetReps;
      if (weight === null || reps === null) throw new BadRequestException('weight and reps are required (no target)');
      await this.prisma.sessionSet.update({ where: { id: set.id }, data: { weight, reps, done: true, doneAt: now } });
    } else {
      await this.prisma.sessionSet.update({
        where: { id: set.id },
        data: { weight: dto.weight ?? null, reps: dto.reps ?? null, done: false, doneAt: null },
      });
    }

    // The real order of the exercises: the time of their first validated set.
    const done = await this.prisma.sessionSet.findMany({
      where: { sessionExerciseId: id, done: true },
      orderBy: { doneAt: 'asc' },
    });
    await this.prisma.sessionExercise.update({
      where: { id },
      data: {
        firstSetAt: done[0]?.doneAt ?? null,
        ...(done.length === 0 ? { completed: false } : {}),
      },
    });
    return this.getExercise(sessionId, id);
  }

  /** Ressenti and/or Terminé. */
  async updateExercise(sessionId: string, id: string, dto: UpdateSessionExerciseDto): Promise<SessionExerciseDto> {
    const entry = await this.openEntry(sessionId, id);
    if (dto.completed && !entry.sets.some((s) => s.done)) {
      throw new BadRequestException('Terminé needs at least one validated set');
    }
    await this.prisma.sessionExercise.update({
      where: { id },
      data: {
        ...(dto.feeling !== undefined ? { feeling: dto.feeling } : {}),
        ...(dto.completed !== undefined ? { completed: dto.completed } : {}),
      },
    });
    return this.getExercise(sessionId, id);
  }

  /** Terminer la séance: exercises with no validated set are dropped (a session with none is discarded). */
  async finish(id: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.finishedAt) throw new ConflictException('Session already finished');
    await this.prisma.sessionExercise.deleteMany({ where: { sessionId: id, sets: { none: { done: true } } } });
    const left = await this.prisma.sessionExercise.count({ where: { sessionId: id } });
    if (left === 0) await this.prisma.session.delete({ where: { id } });
    else await this.prisma.session.update({ where: { id }, data: { finishedAt: new Date() } });
  }

  /** Quitter la séance: discards it. */
  async remove(id: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    await this.prisma.session.delete({ where: { id } });
  }

  /** First set of an exercise: its pre-fatigue and the targets of every set are fixed now. */
  private async freeze(sessionId: string, id: string) {
    const session = await this.prisma.session.findUniqueOrThrow({ where: { id: sessionId }, include: SESSION_INCLUDE });
    const entry = session.exercises.find((e) => e.id === id)!;
    const fatigue = entryPreFatigue(entry, session.exercises);
    const targets = await this.targetsFor(sessionId, entry, fatigue.value);
    await this.prisma.$transaction([
      this.prisma.sessionExercise.update({ where: { id }, data: { preFatigue: fatigue.value } }),
      ...entry.sets.map((s, i) =>
        this.prisma.sessionSet.update({
          where: { id: s.id },
          data: { targetWeight: targets?.[i]?.weight ?? null, targetReps: targets?.[i]?.reps ?? null },
        }),
      ),
    ]);
    return this.openEntry(sessionId, id);
  }

  private targetsFor(
    sessionId: string,
    entry: { exerciseId: string; repMin: number; repMax: number; sets: unknown[]; exercise: { equipment: Equipment } },
    todayPreFatigue: number,
  ) {
    return this.progression.targets({
      exerciseId: entry.exerciseId,
      equipment: entry.exercise.equipment,
      setCount: entry.sets.length,
      repMin: entry.repMin,
      repMax: entry.repMax,
      todayPreFatigue,
      sessionId,
    });
  }

  private async openEntry(sessionId: string, id: string) {
    const entry = await this.prisma.sessionExercise.findFirst({
      where: { id, sessionId },
      include: { session: true, ...SETS },
    });
    if (!entry) throw new NotFoundException('Session exercise not found');
    if (entry.session.finishedAt) throw new ConflictException('Session already finished');
    return entry;
  }

  /** The validated sets of the last finished session with this exercise (other than this one). */
  private async lastTime(exerciseId: string, sessionId: string): Promise<LastTimeDto | null> {
    const last = await this.prisma.sessionExercise.findFirst({
      where: {
        exerciseId,
        sessionId: { not: sessionId },
        session: { finishedAt: { not: null } },
        sets: { some: { done: true } },
      },
      orderBy: { session: { finishedAt: 'desc' } },
      include: { session: true, sets: { where: { done: true }, orderBy: { index: 'asc' } } },
    });
    if (!last?.session.finishedAt) return null;
    return {
      date: parisToday(last.session.finishedAt),
      sets: last.sets.map((s) => ({ weight: num(s.weight!), reps: s.reps! })),
    };
  }
}
