import { matchesSearch, parisToday, searchKey, volume } from '@healthmanager/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { num } from '../common/decimal.js';
import type { Exercise, Program, Workout, WorkoutItem } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExerciseHistoryEntryDto } from './dto/exercise-history.dto.js';
import { ExerciseDto } from './dto/exercise.dto.js';
import { SaveExerciseDto } from './dto/save-exercise.dto.js';

/** Bank images are static files of the SPA (frontend/public/exercises). */
export const EXERCISE_IMAGE_DIR = '/exercises';

/** An exercise with the workouts it is part of (and their programs). */
export type ExerciseRow = Exercise & { workoutItems: (WorkoutItem & { workout: Workout & { program: Program } })[] };

/** Load an exercise with what toExerciseDto needs. */
export const EXERCISE_INCLUDE = { workoutItems: { include: { workout: { include: { program: true } } } } } as const;

/** Active program first, then programs in order, then workouts in rotation order. */
function workoutOrder(a: Workout & { program: Program }, b: Workout & { program: Program }): number {
  return (
    Number(b.program.active) - Number(a.program.active) ||
    a.program.position - b.program.position ||
    a.position - b.position
  );
}

export function toExerciseDto(exercise: ExerciseRow): ExerciseDto {
  return {
    id: exercise.id,
    name: exercise.name,
    equipment: exercise.equipment,
    primaryMuscles: exercise.primaryMuscles,
    secondaryMuscles: exercise.secondaryMuscles,
    imageUrl: exercise.image ? `${EXERCISE_IMAGE_DIR}/${exercise.image}` : null,
    workouts: [...exercise.workoutItems]
      .sort((a, b) => workoutOrder(a.workout, b.workout))
      .map((item) => ({
        id: item.workout.id,
        name: item.workout.name,
        sets: item.sets,
        repMin: item.repMin,
        repMax: item.repMax,
        programId: item.workout.programId,
        programActive: item.workout.program.active,
      })),
  };
}

function toData(dto: SaveExerciseDto) {
  const name = dto.name.trim();
  if (!name) throw new BadRequestException('name must not be blank');
  if (dto.secondaryMuscles.some((m) => dto.primaryMuscles.includes(m))) {
    throw new BadRequestException('A muscle cannot be both primary and secondary');
  }
  return {
    name,
    searchName: searchKey(name),
    equipment: dto.equipment,
    primaryMuscles: dto.primaryMuscles,
    secondaryMuscles: dto.secondaryMuscles,
  };
}

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  /** The bank (about fifty exercises): every word of the query, accent/case-insensitive; by name. */
  async list(query: string): Promise<ExerciseDto[]> {
    const all = await this.prisma.exercise.findMany({ where: { archived: false }, include: EXERCISE_INCLUDE });
    return all
      .filter((e) => matchesSearch(e.searchName, query))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .map(toExerciseDto);
  }

  async get(id: string): Promise<ExerciseDto> {
    const exercise = await this.prisma.exercise.findUnique({ where: { id }, include: EXERCISE_INCLUDE });
    if (!exercise) throw new NotFoundException('Exercise not found');
    return toExerciseDto(exercise);
  }

  /** Every finished session with this exercise, most recent first. */
  async history(id: string): Promise<ExerciseHistoryEntryDto[]> {
    await this.get(id);
    const entries = await this.prisma.sessionExercise.findMany({
      where: { exerciseId: id, session: { finishedAt: { not: null } }, sets: { some: { done: true } } },
      orderBy: { session: { finishedAt: 'desc' } },
      include: { session: true, sets: { where: { done: true }, orderBy: { index: 'asc' } } },
    });
    return entries.map((e) => {
      const sets = e.sets.map((s) => ({ weight: num(s.weight!), reps: s.reps! }));
      return {
        sessionId: e.sessionId,
        date: parisToday(e.session.finishedAt!),
        sets,
        feeling: e.feeling,
        preFatigue: e.preFatigue === null ? 0 : num(e.preFatigue),
        inSuperset: e.supersetGroup !== null,
        volume: volume(sets),
        heaviest: Math.max(...sets.map((s) => s.weight)),
      };
    });
  }

  async create(dto: SaveExerciseDto): Promise<ExerciseDto> {
    return toExerciseDto(await this.prisma.exercise.create({ data: toData(dto), include: EXERCISE_INCLUDE }));
  }

  async update(id: string, dto: SaveExerciseDto): Promise<ExerciseDto> {
    await this.get(id);
    return toExerciseDto(await this.prisma.exercise.update({ where: { id }, data: toData(dto), include: EXERCISE_INCLUDE }));
  }
}
