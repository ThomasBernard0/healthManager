import { randomUUID } from 'node:crypto';
import { nextWorkout, parisToday, validSupersetGroups } from '@healthmanager/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EXERCISE_INCLUDE, toExerciseDto } from '../exercises/exercises.service.js';
import type { Program } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressionService } from '../sessions/progression.service.js';
import { SaveWorkoutDto } from './dto/save-workout.dto.js';
import { WorkoutDto, WorkoutSummaryDto } from './dto/workout.dto.js';

const ITEMS = { items: { orderBy: { position: 'asc' }, include: { exercise: { include: EXERCISE_INCLUDE } } } } as const;

@Injectable()
export class WorkoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progression: ProgressionService,
  ) {}

  /** The active program's rotation (Accueil). */
  async list(): Promise<WorkoutSummaryDto[]> {
    const program = await this.prisma.program.findFirst({ where: { active: true } });
    return program ? this.summaries(program) : [];
  }

  /**
   * A program's workouts in rotation order, with the last date of each. In the active program, the next one
   * (after the workout of the last session finished since its activation, else the first) is flagged and comes
   * with the targets of its exercises (no pre-fatigue assumed).
   */
  async summaries(program: Program): Promise<WorkoutSummaryDto[]> {
    const workouts = await this.prisma.workout.findMany({
      where: { programId: program.id },
      orderBy: { position: 'asc' },
      include: { items: { orderBy: { position: 'asc' }, include: { exercise: true } } },
    });
    const ids = workouts.map((w) => w.id);
    const [lastByWorkout, lastSession] = await Promise.all([
      this.prisma.session.groupBy({
        by: ['workoutId'],
        where: { finishedAt: { not: null }, workoutId: { in: ids } },
        _max: { finishedAt: true },
      }),
      program.active
        ? this.prisma.session.findFirst({
            where: { finishedAt: { gte: program.activatedAt }, workoutId: { in: ids } },
            orderBy: { finishedAt: 'desc' },
          })
        : null,
    ]);
    const next = program.active ? nextWorkout(workouts, lastSession?.workoutId ?? null) : null;
    const lastDone = new Map(lastByWorkout.map((g) => [g.workoutId, g._max.finishedAt]));
    const nextTargets = next
      ? await Promise.all(
          next.items.map((i) =>
            this.progression.targets({
              exerciseId: i.exerciseId,
              equipment: i.exercise.equipment,
              setCount: i.exercise.sets,
              repMin: i.exercise.repMin,
              repMax: i.exercise.repMax,
            }),
          ),
        )
      : [];
    return workouts.map((w) => {
      const finishedAt = lastDone.get(w.id);
      return {
        id: w.id,
        name: w.name,
        position: w.position,
        exercises: w.items.map((i, k) => ({
          name: i.exercise.name,
          targets: w.id === next?.id ? nextTargets[k] : null,
        })),
        lastDoneOn: finishedAt ? parisToday(finishedAt) : null,
        isNext: w.id === next?.id,
      };
    });
  }

  async get(id: string): Promise<WorkoutDto> {
    const workout = await this.prisma.workout.findUnique({ where: { id }, include: { ...ITEMS, program: true } });
    if (!workout) throw new NotFoundException('Workout not found');
    return {
      id: workout.id,
      name: workout.name,
      position: workout.position,
      programId: workout.programId,
      programActive: workout.program.active,
      items: workout.items.map((i) => ({
        exercise: toExerciseDto(i.exercise),
        group: i.supersetGroup,
      })),
    };
  }

  /** Added at the end of its program's rotation (the active program by default). */
  async create(dto: SaveWorkoutDto): Promise<WorkoutDto> {
    const data = await this.validate(dto);
    const program = await this.prisma.program.findFirst({
      where: dto.programId ? { id: dto.programId } : { active: true },
    });
    if (!program) throw new BadRequestException('Unknown program');
    const { _max } = await this.prisma.workout.aggregate({
      where: { programId: program.id },
      _max: { position: true },
    });
    const workout = await this.prisma.workout.create({
      data: {
        name: data.name,
        programId: program.id,
        position: (_max.position ?? 0) + 1,
        items: { create: data.items },
      },
    });
    return this.get(workout.id);
  }

  async update(id: string, dto: SaveWorkoutDto): Promise<WorkoutDto> {
    await this.get(id);
    const data = await this.validate(dto);
    await this.prisma.$transaction([
      this.prisma.workoutItem.deleteMany({ where: { workoutId: id } }),
      this.prisma.workout.update({ where: { id }, data: { name: data.name, items: { create: data.items } } }),
    ]);
    return this.get(id);
  }

  /** The workouts after it in its program move up one place. */
  async remove(id: string): Promise<void> {
    const workout = await this.prisma.workout.findUnique({ where: { id } });
    if (!workout) throw new NotFoundException('Workout not found');
    await this.prisma.$transaction([
      this.prisma.workout.delete({ where: { id } }),
      this.prisma.workout.updateMany({
        where: { programId: workout.programId, position: { gt: workout.position } },
        data: { position: { decrement: 1 } },
      }),
    ]);
  }

  private async validate(dto: SaveWorkoutDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('name must not be blank');
    const ids = dto.items.map((i) => i.exerciseId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('An exercise appears twice');
    const known = await this.prisma.exercise.count({ where: { id: { in: ids } } });
    if (known !== ids.length) throw new BadRequestException('Unknown exercise');
    if (!validSupersetGroups(dto.items.map((i) => i.group ?? null))) {
      throw new BadRequestException('A superset is two adjacent exercises');
    }
    // The ids sent are only labels: each pair gets its own uuid.
    const groups = new Map<string, string>();
    for (const i of dto.items) if (i.group && !groups.has(i.group)) groups.set(i.group, randomUUID());
    return {
      name,
      items: dto.items.map((i, position) => ({
        exerciseId: i.exerciseId,
        position,
        supersetGroup: i.group ? groups.get(i.group)! : null,
      })),
    };
  }
}
