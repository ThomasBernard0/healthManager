import type { Equipment, Muscle } from './muscu.js';

/** Musculation progression (double progression), spec §3. Pure functions, used by the API. */

export type Feeling = 'easy' | 'ok' | 'hard';

/** Default weight step by equipment (kg); bodyweight = added load. */
export const DEFAULT_STEP: Record<Equipment, number> = {
  barbell: 2.5,
  dumbbell: 2,
  machine: 5,
  cable: 2.5,
  bodyweight: 2.5,
};

/**
 * One step up: the first known weight above `current` if it is at most 2 steps away (real plates,
 * stacks, dumbbells already used), else `current + step`.
 */
export function stepUp(current: number, known: number[], step: number): number {
  const above = known.filter((w) => w > current).sort((a, b) => a - b)[0];
  return above !== undefined && above <= current + 2 * step ? above : current + step;
}

/** One step down, mirroring stepUp; never below 0. */
export function stepDown(current: number, known: number[], step: number): number {
  const below = known.filter((w) => w < current).sort((a, b) => b - a)[0];
  const next = below !== undefined && below >= current - 2 * step ? below : current - step;
  return Math.max(0, next);
}

export interface ExerciseMuscles {
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
}

export interface PreFatigue {
  /** Sets that already hit the exercise's primary muscles (½ when only secondary there). */
  value: number;
  /** The exercise's primary muscles already worked, in its own order. */
  muscles: Muscle[];
}

/**
 * Pre-fatigue of an exercise: sets done earlier in the same session that hit its primary muscles.
 * An earlier exercise sharing one of them counts 1 per set if that muscle is primary there, ½ if
 * secondary. Bench press after 3 sets of dips → 3; after curls → 0.
 */
export function preFatigue(target: ExerciseMuscles, earlier: (ExerciseMuscles & { sets: number })[]): PreFatigue {
  let value = 0;
  const hit = new Set<Muscle>();
  for (const other of earlier) {
    if (other.sets <= 0) continue;
    const primary = target.primaryMuscles.filter((m) => other.primaryMuscles.includes(m));
    const secondary = target.primaryMuscles.filter((m) => other.secondaryMuscles.includes(m));
    if (primary.length > 0) value += other.sets;
    else if (secondary.length > 0) value += other.sets / 2;
    for (const m of [...primary, ...secondary]) hit.add(m);
  }
  return { value, muscles: target.primaryMuscles.filter((m) => hit.has(m)) };
}

export interface LoggedSet {
  weight: number;
  reps: number;
  /** What was targeted (null the first time). */
  targetWeight: number | null;
  targetReps: number | null;
}

/** The done sets of one past session of an exercise. */
export interface ExerciseLog {
  sets: LoggedSet[];
  feeling: Feeling | null;
  preFatigue: number;
  /** Every planned set was done (false: the exercise was stopped early). */
  complete: boolean;
  /** Done in a superset (shorter rest than solo). */
  inSuperset: boolean;
}

export interface Target {
  weight: number;
  reps: number;
}

export type Verdict = 'up' | 'down' | 'retry' | 'progress';

const total = (log: ExerciseLog) => log.sets.reduce((sum, s) => sum + s.reps, 0);
const belowMin = (log: ExerciseLog, repMin: number) => total(log) < log.sets.length * repMin;

/**
 * Superset context (asymmetric, like pre-fatigue): a session in a superset right after a solo one has
 * less rest, so a worse result there is not a failure. Superset → solo needs no special case.
 */
export function harderInSuperset(log: { inSuperset: boolean }, before: { inSuperset: boolean } | null): boolean {
  return log.inSuperset && before !== null && !before.inSuperset;
}

/**
 * How the last session went (first matching row wins), judged on the total reps so a weaker last
 * set neither blocks progress nor triggers a drop. `previous` is the session before it, and
 * `beforePrevious` the one before that (it tells whether `previous` was a first time in a superset).
 */
export function judge(
  last: ExerciseLog,
  previous: ExerciseLog | null,
  repMin: number,
  repMax: number,
  beforePrevious: ExerciseLog | null = null,
): Verdict {
  // Stopped early: not a real attempt at the targets, so they are simply retried.
  if (!last.complete) return 'retry';
  const n = last.sets.length;
  const sum = total(last);
  if (sum >= n * (repMax - 1) || (last.feeling === 'easy' && sum >= n * repMin)) return 'up';
  // Two sessions in a row under the range, the second not explained by more pre-fatigue.
  // A previous session stopped early never counts as one of the two, nor does a session done in a
  // superset right after a solo one.
  if (
    belowMin(last, repMin) &&
    previous?.complete &&
    belowMin(previous, repMin) &&
    !(last.preFatigue > previous.preFatigue) &&
    !harderInSuperset(last, previous) &&
    !harderInSuperset(previous, beforePrevious)
  ) {
    return 'down';
  }
  if (last.feeling === 'hard' || belowMin(last, repMin)) return 'retry';
  return 'progress';
}

export interface NextTargetsInput {
  /** Last time the exercise was done; null: first time (no target). */
  last: ExerciseLog | null;
  /** The time before. */
  previous: ExerciseLog | null;
  /** The time before `previous` (default: none). */
  beforePrevious?: ExerciseLog | null;
  /** Sets of the workout item now. */
  setCount: number;
  repMin: number;
  repMax: number;
  /** Distinct weights already logged for the exercise. */
  known: number[];
  step: number;
  /** Pre-fatigue of the exercise now. */
  todayPreFatigue: number;
  /** The exercise is in a superset now (default: solo). */
  todayInSuperset?: boolean;
}

/**
 * Targets of each set, from the last time the exercise was done. Each set keeps its own weight and all
 * move together (drop sets keep their shape). null: first time, the user types everything.
 */
export function nextTargets(input: NextTargetsInput): Target[] | null {
  const { last, previous, setCount, repMin, repMax, known, step, todayPreFatigue } = input;
  if (!last || last.sets.length === 0) return null;

  const verdict = judge(last, previous, repMin, repMax, input.beforePrevious ?? null);
  // Harder today than last time (more pre-fatigue, or a superset after a solo session): no +1.
  const harderToday =
    todayPreFatigue > last.preFatigue || harderInSuperset({ inSuperset: input.todayInSuperset ?? false }, last);
  const targets = last.sets.map((s): Target => {
    switch (verdict) {
      case 'up':
        return { weight: stepUp(s.weight, known, step), reps: repMin };
      case 'down':
        return { weight: stepDown(s.weight, known, step), reps: repMin };
      case 'retry':
        // Retried, never lowered to what was done.
        return { weight: s.weight, reps: s.targetReps ?? s.reps };
      case 'progress':
        return { weight: s.weight, reps: harderToday ? s.reps : Math.min(s.reps + 1, repMax) };
    }
  });

  // The workout's set count changed: new sets copy the last set's target.
  return Array.from({ length: setCount }, (_, i) => targets[Math.min(i, targets.length - 1)]);
}
