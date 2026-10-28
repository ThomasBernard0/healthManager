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
    repMin: 7,
    repMax: 10,
    history: [],
    known: [],
  } satisfies FixtureExercise,
  bench: {
    name: 'Développé couché',
    equipment: 'barbell',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders_front'],
    sets: 4,
    repMin: 7,
    repMax: 10,
    history: [
      {
        date: '2026-10-01',
        sets: [set(60, 9, 9), set(60, 9, 9), set(60, 8, 8), set(60, 8, 7)],
        easy: false,
        preFatigue: 0,
        complete: true,
      },
      {
        date: '2026-09-28',
        sets: [set(60, 8, 7), set(60, 8, 7), set(60, 8, 7), set(60, 7, 7)],
        easy: false,
        preFatigue: 0,
        complete: true,
      },
    ],
    known: [57.5, 60],
  } satisfies FixtureExercise,
  /** Bench targets (total 34 → +1), done first or after 3 sets of Dips: pre-fatigue never blocks the +1. */
  benchTargets: [
    { weight: 60, reps: 10 },
    { weight: 60, reps: 10 },
    { weight: 60, reps: 9 },
    { weight: 60, reps: 9 },
  ] satisfies Target[],
};
