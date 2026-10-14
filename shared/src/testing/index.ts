import type { Equipment, Muscle } from '../muscu.js';
import type { ExerciseLog, Target } from '../progression.js';

/** A past session of an exercise, with its Europe/Paris date. */
export type DatedLog = ExerciseLog & { date: string };

export interface FixtureExercise {
  name: string;
  equipment: Equipment;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  sets: number;
  repMin: number;
  repMax: number;
  /** Most recent first. */
  history: DatedLog[];
  known: number[];
}

const set = (weight: number, reps: number, targetReps: number | null = null) => ({
  weight,
  reps,
  targetWeight: targetReps === null ? null : weight,
  targetReps,
});

/**
 * Développé couché after 3 sets of Dips (spec §7): the same history gives the same targets on
 * the server and on the phone. Shared by the backend and frontend tests.
 */
export const DIPS_THEN_BENCH = {
  dips: {
    name: 'Dips',
    equipment: 'bodyweight',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps'],
    sets: 3,
    repMin: 8,
    repMax: 12,
    history: [],
    known: [],
  } satisfies FixtureExercise,
  bench: {
    name: 'Développé couché',
    equipment: 'barbell',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders_front'],
    sets: 4,
    repMin: 8,
    repMax: 12,
    history: [
      {
        date: '2026-10-01',
        sets: [set(60, 10, 9), set(60, 10, 9), set(60, 9, 9), set(60, 9, 8)],
        easy: false,
        preFatigue: 0,
        complete: true,
        inSuperset: false,
      },
      {
        date: '2026-09-28',
        sets: [set(60, 9, 8), set(60, 9, 8), set(60, 9, 8), set(60, 8, 8)],
        easy: false,
        preFatigue: 0,
        complete: true,
        inSuperset: false,
      },
      {
        date: '2026-09-24',
        sets: [set(57.5, 12), set(57.5, 11), set(57.5, 11), set(57.5, 11)],
        easy: true,
        preFatigue: 0,
        complete: true,
        inSuperset: false,
      },
    ],
    known: [57.5, 60],
  } satisfies FixtureExercise,
  /** Bench targets once 3 sets of Dips are done: more pre-fatigue than last time, so no +1. */
  benchAfterDips: [
    { weight: 60, reps: 10 },
    { weight: 60, reps: 10 },
    { weight: 60, reps: 9 },
    { weight: 60, reps: 9 },
  ] satisfies Target[],
  /** Bench targets done first. */
  benchFirst: [
    { weight: 60, reps: 11 },
    { weight: 60, reps: 11 },
    { weight: 60, reps: 10 },
    { weight: 60, reps: 10 },
  ] satisfies Target[],
};
