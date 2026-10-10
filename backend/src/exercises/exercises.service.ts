import { matchesSearch, searchKey } from '@healthmanager/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Exercise, Workout, WorkoutItem } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExerciseDto } from './dto/exercise.dto.js';
import { SaveExerciseDto } from './dto/save-exercise.dto.js';

/** Bank images are static files of the SPA (frontend/public/exercises). */
export const EXERCISE_IMAGE_DIR = '/exercises';

/** An exercise with the workouts it is part of. */
export type ExerciseRow = Exercise & { workoutItems: (WorkoutItem & { workout: Workout })[] };

/** Load an exercise with what toExerciseDto needs. */
export const EXERCISE_INCLUDE = { workoutItems: { include: { workout: true } } } as const;

export function toExerciseDto(exercise: ExerciseRow): ExerciseDto {
  return {
    id: exercise.id,
    name: exercise.name,
    equipment: exercise.equipment,
    primaryMuscles: exercise.primaryMuscles,
    secondaryMuscles: exercise.secondaryMuscles,
    imageUrl: exercise.image ? `${EXERCISE_IMAGE_DIR}/${exercise.image}` : null,
    workouts: [...exercise.workoutItems]
      .sort((a, b) => a.workout.position - b.workout.position)
      .map((item) => ({
        id: item.workout.id,
        name: item.workout.name,
        sets: item.sets,
        repMin: item.repMin,
        repMax: item.repMax,
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

  async create(dto: SaveExerciseDto): Promise<ExerciseDto> {
    return toExerciseDto(await this.prisma.exercise.create({ data: toData(dto), include: EXERCISE_INCLUDE }));
  }

  async update(id: string, dto: SaveExerciseDto): Promise<ExerciseDto> {
    await this.get(id);
    return toExerciseDto(await this.prisma.exercise.update({ where: { id }, data: toData(dto), include: EXERCISE_INCLUDE }));
  }
}
