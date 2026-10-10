import { nextWorkout, parisToday } from '@healthmanager/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EXERCISE_INCLUDE, toExerciseDto } from '../exercises/exercises.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SaveWorkoutDto } from './dto/save-workout.dto.js';
import { WorkoutDto, WorkoutSummaryDto } from './dto/workout.dto.js';

const ITEMS = { items: { orderBy: { position: 'asc' }, include: { exercise: { include: EXERCISE_INCLUDE } } } } as const;

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The rotation, in order: last date of each workout, and the next one (after the last finished session). */
  async list(): Promise<WorkoutSummaryDto[]> {
    const [workouts, lastByWorkout, lastSession] = await Promise.all([
      this.prisma.workout.findMany({
        orderBy: { position: 'asc' },
        include: { items: { orderBy: { position: 'asc' }, include: { exercise: true } } },
      }),
      this.prisma.session.groupBy({
        by: ['workoutId'],
        where: { finishedAt: { not: null }, workoutId: { not: null } },
        _max: { finishedAt: true },
      }),
      this.prisma.session.findFirst({ where: { finishedAt: { not: null } }, orderBy: { finishedAt: 'desc' } }),
    ]);
    const next = nextWorkout(workouts, lastSession?.workoutId ?? null);
    const lastDone = new Map(lastByWorkout.map((g) => [g.workoutId, g._max.finishedAt]));
    return workouts.map((w) => {
      const finishedAt = lastDone.get(w.id);
      return {
        id: w.id,
        name: w.name,
        position: w.position,
        exerciseNames: w.items.map((i) => i.exercise.name),
        lastDoneOn: finishedAt ? parisToday(finishedAt) : null,
        isNext: w.id === next?.id,
      };
    });
  }

  async get(id: string): Promise<WorkoutDto> {
    const workout = await this.prisma.workout.findUnique({ where: { id }, include: ITEMS });
    if (!workout) throw new NotFoundException('Workout not found');
    return {
      id: workout.id,
      name: workout.name,
      position: workout.position,
      items: workout.items.map((i) => ({
        exercise: toExerciseDto(i.exercise),
        sets: i.sets,
        repMin: i.repMin,
        repMax: i.repMax,
      })),
    };
  }

  /** Added at the end of the rotation. */
  async create(dto: SaveWorkoutDto): Promise<WorkoutDto> {
    const data = await this.validate(dto);
    const { _max } = await this.prisma.workout.aggregate({ _max: { position: true } });
    const workout = await this.prisma.workout.create({
      data: { name: data.name, position: (_max.position ?? 0) + 1, items: { create: data.items } },
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

  /** The workouts after it move up one place. */
  async remove(id: string): Promise<void> {
    const workout = await this.prisma.workout.findUnique({ where: { id } });
    if (!workout) throw new NotFoundException('Workout not found');
    await this.prisma.$transaction([
      this.prisma.workout.delete({ where: { id } }),
      this.prisma.workout.updateMany({
        where: { position: { gt: workout.position } },
        data: { position: { decrement: 1 } },
      }),
    ]);
  }

  private async validate(dto: SaveWorkoutDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('name must not be blank');
    const ids = dto.items.map((i) => i.exerciseId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('An exercise appears twice');
    if (dto.items.some((i) => i.repMax < i.repMin)) throw new BadRequestException('repMax must be ≥ repMin');
    const known = await this.prisma.exercise.count({ where: { id: { in: ids } } });
    if (known !== ids.length) throw new BadRequestException('Unknown exercise');
    return {
      name,
      items: dto.items.map((i, position) => ({
        exerciseId: i.exerciseId,
        sets: i.sets,
        repMin: i.repMin,
        repMax: i.repMax,
        position,
      })),
    };
  }
}
