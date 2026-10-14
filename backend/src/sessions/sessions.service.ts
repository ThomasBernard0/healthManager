import { DEFAULT_STEP } from '@healthmanager/shared';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { num } from '../common/decimal.js';
import { EXERCISE_INCLUDE, toExerciseDto } from '../exercises/exercises.service.js';
import type { SessionSet } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { entryPreFatigue, ProgressionService } from './progression.service.js';
import { FinishExerciseDto, FinishSessionDto } from './dto/save-session.dto.js';
import { CurrentSessionDto, ExerciseStatus, SessionBundleDto, SessionDto, SessionSetDto } from './dto/session.dto.js';

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
  doneAt: s.doneAt?.toISOString() ?? null,
});

function status(e: { completed: boolean; sets: { done: boolean }[] }): ExerciseStatus {
  if (e.completed) return 'done';
  return e.sets.some((s) => s.done) ? 'inProgress' : 'todo';
}

interface Grouped {
  id: string;
  supersetGroup: string | null;
}

/** The other exercise of its superset. */
export function partnerOf<E extends Grouped>(entry: Grouped, entries: E[]): E | null {
  if (entry.supersetGroup === null) return null;
  return entries.find((e) => e.id !== entry.id && e.supersetGroup === entry.supersetGroup) ?? null;
}

/** An exercise of the session, as Terminer checks the body against it. */
interface StoredEntry {
  id: string;
  exercise: { equipment: string };
  sets: { index: number }[];
}

/**
 * Checks what the phone sends against the session: its own exercises, each once; set indexes within the set
 * count, each once; help (a negative weight) on bodyweight exercises only; a validated set with its values
 * and time.
 */
export function checkFinish(sent: FinishExerciseDto[], stored: StoredEntry[]): void {
  const seen = new Set<string>();
  for (const e of sent) {
    const entry = stored.find((s) => s.id === e.id);
    if (!entry) throw new BadRequestException(`exercise ${e.id} is not in this session`);
    if (seen.has(e.id)) throw new BadRequestException(`exercise ${e.id} is sent twice`);
    seen.add(e.id);
    const indexes = new Set<number>();
    for (const set of e.sets) {
      if (!entry.sets.some((s) => s.index === set.index)) {
        throw new BadRequestException(`set index ${set.index} is out of range`);
      }
      if (indexes.has(set.index)) throw new BadRequestException(`set index ${set.index} is sent twice`);
      indexes.add(set.index);
      if (typeof set.weight === 'number' && set.weight < 0 && entry.exercise.equipment !== 'bodyweight') {
        throw new BadRequestException('weight must not be negative (bodyweight exercises only)');
      }
      if (set.done && (set.weight == null || set.reps == null || set.doneAt == null)) {
        throw new BadRequestException('a validated set needs weight, reps and doneAt');
      }
    }
  }
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
   * Démarrer: one session at a time, workouts of the active program only; every exercise of the workout with the
   * sets and rep range it has now. Returns the bundle the phone runs the session from.
   */
  async start(workoutId: string): Promise<SessionBundleDto> {
    const open = await this.prisma.session.findFirst({ where: { finishedAt: null } });
    if (open) throw new ConflictException('A session is already in progress');
    const workout = await this.prisma.workout.findUnique({
      where: { id: workoutId },
      include: { items: { orderBy: { position: 'asc' }, include: { exercise: true } }, program: true },
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
            repMin: item.exercise.repMin,
            repMax: item.exercise.repMax,
            supersetGroup: item.supersetGroup,
            sets: { create: Array.from({ length: item.exercise.sets }, (_, index) => ({ index })) },
          })),
        },
      },
    });
    return this.bundle(session.id);
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
        supersetGroup: e.supersetGroup,
      })),
    };
  }

  /**
   * The session bundle: the session in progress and, for each exercise, what the phone needs to compute its
   * targets with the shared functions (history, known weights, step). Démarrer returns the same.
   */
  async bundle(id: string): Promise<SessionBundleDto> {
    const session = await this.prisma.session.findUnique({ where: { id }, include: SESSION_INCLUDE });
    if (!session) throw new NotFoundException('Session not found');
    if (session.finishedAt) throw new ConflictException('Session already finished');
    const exercises = await Promise.all(
      session.exercises.map(async (e) => {
        const [history, knownWeights] = await Promise.all([
          this.progression.history(e.exerciseId),
          this.progression.knownWeights(e.exerciseId),
        ]);
        return {
          id: e.id,
          exercise: toExerciseDto(e.exercise),
          repMin: e.repMin,
          repMax: e.repMax,
          supersetGroup: e.supersetGroup,
          easy: e.easy,
          completed: e.completed,
          sets: e.sets.map(toSetDto),
          history,
          knownWeights,
          step: DEFAULT_STEP[e.exercise.equipment],
        };
      }),
    );
    return {
      id: session.id,
      workoutId: session.workoutId,
      workoutName: session.workoutName,
      startedAt: session.startedAt.toISOString(),
      exercises,
    };
  }

  /**
   * Terminer la séance with the whole session run on the phone, in one transaction: the sets, Facile and
   * Terminé are stored; the real order (first set of each exercise) and the pre-fatigue come from doneAt; then
   * exercises with no validated set are dropped (a session with none is discarded) and an exercise whose
   * superset partner was dropped was done solo. Already finished: nothing to do (a retry after a lost response).
   */
  async finish(id: string, dto: FinishSessionDto): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { id },
        include: { exercises: { include: { exercise: true, ...SETS } } },
      });
      if (!session) throw new NotFoundException('Session not found');
      if (session.finishedAt) return;
      checkFinish(dto.exercises, session.exercises);

      for (const sent of dto.exercises) {
        const entry = session.exercises.find((e) => e.id === sent.id)!;
        for (const set of sent.sets) {
          await tx.sessionSet.update({
            where: { id: entry.sets.find((s) => s.index === set.index)!.id },
            data: {
              targetWeight: set.targetWeight ?? null,
              targetReps: set.targetReps ?? null,
              weight: set.weight ?? null,
              reps: set.reps ?? null,
              done: set.done,
              doneAt: set.done ? new Date(set.doneAt!) : null,
            },
          });
        }
      }

      const stored = await tx.sessionExercise.findMany({ where: { sessionId: id }, include: { exercise: true, ...SETS } });
      const entries = stored.map((e) => {
        const times = e.sets.filter((s) => s.done && s.doneAt).map((s) => s.doneAt!.getTime());
        return { ...e, firstSetAt: times.length > 0 ? new Date(Math.min(...times)) : null };
      });
      const left = entries.filter((e) => e.firstSetAt !== null);
      if (left.length === 0) {
        await tx.session.delete({ where: { id } });
        return;
      }
      for (const entry of left) {
        const sent = dto.exercises.find((e) => e.id === entry.id);
        await tx.sessionExercise.update({
          where: { id: entry.id },
          data: {
            firstSetAt: entry.firstSetAt,
            preFatigue: entryPreFatigue(entry, entries).value,
            ...(sent ? { easy: sent.easy, completed: sent.completed } : {}),
          },
        });
      }
      await tx.sessionExercise.deleteMany({ where: { sessionId: id, id: { notIn: left.map((e) => e.id) } } });
      const alone = left.filter((e) => e.supersetGroup !== null && !partnerOf(e, left)).map((e) => e.id);
      await tx.sessionExercise.updateMany({ where: { id: { in: alone } }, data: { supersetGroup: null } });
      await tx.session.update({ where: { id }, data: { finishedAt: new Date() } });
    });
  }

  /** Quitter la séance: discards it. */
  async remove(id: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    await this.prisma.session.delete({ where: { id } });
  }
}
