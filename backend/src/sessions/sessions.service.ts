import { parisToday } from '@healthmanager/shared';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { num } from '../common/decimal.js';
import { EXERCISE_INCLUDE, toExerciseDto } from '../exercises/exercises.service.js';
import type { SessionSet } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
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
  constructor(private readonly prisma: PrismaService) {}

  async current(): Promise<CurrentSessionDto> {
    const open = await this.prisma.session.findFirst({ where: { finishedAt: null }, orderBy: { startedAt: 'desc' } });
    return { session: open ? await this.get(open.id) : null };
  }

  /** Démarrer: one session at a time; every exercise of the workout with its sets (no targets yet). */
  async start(workoutId: string): Promise<SessionDto> {
    const open = await this.prisma.session.findFirst({ where: { finishedAt: null } });
    if (open) throw new ConflictException('A session is already in progress');
    const workout = await this.prisma.workout.findUnique({
      where: { id: workoutId },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!workout) throw new NotFoundException('Workout not found');
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
      })),
    };
  }

  async getExercise(sessionId: string, id: string): Promise<SessionExerciseDto> {
    const entry = await this.prisma.sessionExercise.findFirst({
      where: { id, sessionId },
      include: { session: true, exercise: { include: EXERCISE_INCLUDE }, ...SETS },
    });
    if (!entry) throw new NotFoundException('Session exercise not found');
    return {
      id: entry.id,
      sessionId: entry.sessionId,
      workoutName: entry.session.workoutName,
      exercise: toExerciseDto(entry.exercise),
      repMin: entry.repMin,
      repMax: entry.repMax,
      feeling: entry.feeling,
      completed: entry.completed,
      sets: entry.sets.map(toSetDto),
      lastTime: await this.lastTime(entry.exerciseId, entry.sessionId),
    };
  }

  /** ✓ on a set row: empty values record the target; done = false reopens the row. */
  async saveSet(sessionId: string, id: string, index: number, dto: SaveSetDto): Promise<SessionExerciseDto> {
    const entry = await this.openEntry(sessionId, id);
    const set = entry.sets.find((s) => s.index === index);
    if (!set) throw new NotFoundException('Set not found');

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
