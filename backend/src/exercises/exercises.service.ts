import { averageWeight, barKind, chartBarValue, matchesSearch, parisToday, searchKey, volume } from '@healthmanager/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { num } from '../common/decimal.js';
import type { Exercise, ExerciseImage, Program, Workout, WorkoutItem } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExerciseHistoryEntryDto } from './dto/exercise-history.dto.js';
import { EXERCISE_IMAGE_TYPES, type UploadedImage } from './dto/exercise-image.dto.js';
import { ExerciseDto } from './dto/exercise.dto.js';
import { SaveExerciseDto } from './dto/save-exercise.dto.js';

/** An exercise with the workouts it is part of (and their programs), and when its image last changed. */
export type ExerciseRow = Exercise & {
  image: Pick<ExerciseImage, 'updatedAt'> | null;
  workoutItems: (WorkoutItem & { workout: Workout & { program: Program } })[];
};

/** Load an exercise with what toExerciseDto needs. */
export const EXERCISE_INCLUDE = {
  image: { select: { updatedAt: true } },
  workoutItems: { include: { workout: { include: { program: true } } } },
} as const;

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
    sets: exercise.sets,
    repMin: exercise.repMin,
    repMax: exercise.repMax,
    imageVersion: exercise.image ? String(exercise.image.updatedAt.getTime()) : null,
    workouts: [...exercise.workoutItems]
      .sort((a, b) => workoutOrder(a.workout, b.workout))
      .map((item) => ({
        id: item.workout.id,
        name: item.workout.name,
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
  if (dto.repMax < dto.repMin) throw new BadRequestException('repMax must be ≥ repMin');
  return {
    name,
    searchName: searchKey(name),
    equipment: dto.equipment,
    primaryMuscles: dto.primaryMuscles,
    secondaryMuscles: dto.secondaryMuscles,
    sets: dto.sets,
    repMin: dto.repMin,
    repMax: dto.repMax,
  };
}

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mes exercices: every word of the query, accent/case-insensitive; by name. */
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
    const { equipment } = await this.get(id);
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
        easy: e.easy,
        preFatigue: e.preFatigue === null ? 0 : num(e.preFatigue),
        inSuperset: e.supersetGroup !== null,
        volume: volume(sets),
        averageWeight: averageWeight(sets),
        barKind: barKind(equipment),
        barValue: chartBarValue(sets, equipment),
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

  async image(id: string): Promise<Pick<ExerciseImage, 'mime' | 'data'>> {
    const image = await this.prisma.exerciseImage.findUnique({ where: { exerciseId: id } });
    if (!image) throw new NotFoundException('Exercise image not found');
    return image;
  }

  async setImage(id: string, file: UploadedImage | undefined): Promise<ExerciseDto> {
    await this.get(id);
    if (!file || !(EXERCISE_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestException('file must be a JPEG, PNG or WebP image');
    }
    const image = { mime: file.mimetype, data: new Uint8Array(file.buffer) };
    await this.prisma.exerciseImage.upsert({ where: { exerciseId: id }, create: { exerciseId: id, ...image }, update: image });
    return this.get(id);
  }

  async removeImage(id: string): Promise<ExerciseDto> {
    await this.get(id);
    await this.prisma.exerciseImage.deleteMany({ where: { exerciseId: id } });
    return this.get(id);
  }
}
