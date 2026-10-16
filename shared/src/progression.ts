import type { Equipment, Muscle } from './muscu.js';

/** Musculation progression (double progression), spec §3. Pure functions, used by the API and by the phone during a session. */

/**
 * Default weight step by equipment (kg); bodyweight = added load. Machine stacks are 10 lb ≈ 4.5 kg,
 * cable stacks 5 lb ≈ 2.5 kg.
 */
export const DEFAULT_STEP: Record<Equipment, number> = {
  barbell: 5,
  dumbbell: 2,
  machine: 4.5,
  cable: 2.5,
  bodyweight: 2.5,
};

/** Step of an assisted machine (10 lb stack), used while the weight is negative (help on a bodyweight exercise). */
export const ASSIST_STEP = 4.5;

/**
 * One step up: the first known weight above `current` if it is at most 2 steps away (real plates,
 * stacks, dumbbells already used), else `current + step`. From a negative weight (help) the step is
 * ASSIST_STEP and the result never goes above 0: help ends at bodyweight before any added load.
 */
export function stepUp(current: number, known: number[], step: number): number {
  const by = current < 0 ? ASSIST_STEP : step;
  const above = known.filter((w) => w > current).sort((a, b) => a - b)[0];
  const next = above !== undefined && above <= current + 2 * by ? above : current + by;
  return current < 0 ? Math.min(0, next) : next;
}

/**
 * One step down, mirroring stepUp. From 0 or more it never goes below 0 (help is never proposed);
 * from a negative weight it goes down by ASSIST_STEP (more help).
 */
export function stepDown(current: number, known: number[], step: number): number {
  const by = current < 0 ? ASSIST_STEP : step;
  const below = known.filter((w) => w < current).sort((a, b) => b - a)[0];
  const next = below !== undefined && below >= current - 2 * by ? below : current - by;
  return current < 0 ? next : Math.max(0, next);
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

/** An exercise of the session in progress, as its pre-fatigue needs it (times in ms since the epoch). */
export interface SessionEntry {
  id: string;
  /** Time of its first validated set (null: not started). */
  firstSetAt: number | null;
  exercise: ExerciseMuscles;
  sets: { done: boolean; doneAt: number | null }[];
}

/**
 * Pre-fatigue of an exercise in its session: sets of the other exercises validated before its first set
 * (all of them while it is not started).
 */
export function sessionPreFatigue(entry: SessionEntry, entries: SessionEntry[]): PreFatigue {
  const cutoff = entry.firstSetAt ?? Number.POSITIVE_INFINITY;
  return preFatigue(
    entry.exercise,
    entries
      .filter((other) => other.id !== entry.id)
      .map((other) => ({
        ...other.exercise,
        sets: other.sets.filter((s) => s.done && s.doneAt !== null && s.doneAt < cutoff).length,
      })),
  );
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
  /** "Facile" tapped: a clear margin. */
  easy: boolean;
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

export interface Harmonized {
  /** The sets the session is judged on (all of them, unless one was set aside). */
  keptSets: LoggedSet[];
  /** The weight shared by the kept sets (null: drop sets, several weights). */
  commonWeight: number | null;
  /** Index of the lone off-weight set, put back to the common weight next time (null: none). */
  loneIndex: number | null;
}

/**
 * Step 1 (spec §3): every set but exactly one at the same weight → that lone set was an adjustment, not a
 * plan, and is set aside. Needs 3 sets or more (2 sets at 2 weights are drop sets); 3+ distinct weights
 * or a 2 + 2 split are real drop sets, kept as they are.
 */
export function harmonize(sets: LoggedSet[]): Harmonized {
  const counts = new Map<number, number>();
  for (const s of sets) counts.set(s.weight, (counts.get(s.weight) ?? 0) + 1);
  if (counts.size === 1) return { keptSets: sets, commonWeight: sets[0].weight, loneIndex: null };
  // With 3+ sets at 2 weights, a weight done once means the other one is every other set's.
  const loneIndex = sets.findIndex((s) => counts.get(s.weight) === 1);
  if (sets.length >= 3 && counts.size === 2 && loneIndex !== -1) {
    const keptSets = sets.filter((_, i) => i !== loneIndex);
    return { keptSets, commonWeight: keptSets[0].weight, loneIndex };
  }
  return { keptSets: sets, commonWeight: null, loneIndex: null };
}

/** The sets a session is judged on (step 1: a lone off-weight set is set aside). */
const kept = (log: ExerciseLog) => harmonize(log.sets).keptSets;

const total = (log: ExerciseLog) => kept(log).reduce((sum, s) => sum + s.reps, 0);
const belowMin = (log: ExerciseLog, repMin: number) => total(log) < kept(log).length * repMin;

/**
 * Superset context (asymmetric, like pre-fatigue): a session in a superset right after a solo one has
 * less rest, so a worse result there is not a failure. Superset → solo needs no special case.
 */
export function harderInSuperset(log: { inSuperset: boolean }, before: { inSuperset: boolean } | null): boolean {
  return log.inSuperset && before !== null && !before.inSuperset;
}

/**
 * How the last session went (first matching row wins), judged on the total reps of its kept sets
 * (harmonize) so a weaker last set neither blocks progress nor triggers a drop. `previous` is the
 * session before it, and `beforePrevious` the one before that (it tells whether `previous` was a first
 * time in a superset).
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
  const n = kept(last).length;
  const sum = total(last);
  if (sum >= n * (repMax - 1) || (last.easy && sum >= n * repMin)) return 'up';
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
  if (belowMin(last, repMin)) return 'retry';
  return 'progress';
}

export interface NextTargetsInput {
  /** Last time the exercise was done; null: first time (no target). */
  last: ExerciseLog | null;
  /** The time before. */
  previous: ExerciseLog | null;
  /** The time before `previous` (default: none). */
  beforePrevious?: ExerciseLog | null;
  /** Sets of the exercise now. */
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
 * move together (drop sets keep their shape), except a lone off-weight set: it is put back to the common
 * weight with the lowest target of the others, and the rest is consolidated (same reps, no +1) instead of
 * progressing. null: first time, the user types everything.
 */
export function nextTargets(input: NextTargetsInput): Target[] | null {
  const { last, previous, setCount, repMin, repMax, known, step, todayPreFatigue } = input;
  if (!last || last.sets.length === 0) return null;

  const verdict = judge(last, previous, repMin, repMax, input.beforePrevious ?? null);
  const { keptSets, loneIndex } = harmonize(last.sets);
  // Harder today than last time (more pre-fatigue, or a superset after a solo session): no +1.
  // After a harmonization, consolidate: no +1 either.
  const noPlusOne =
    loneIndex !== null ||
    todayPreFatigue > last.preFatigue ||
    harderInSuperset({ inSuperset: input.todayInSuperset ?? false }, last);
  const targets = keptSets.map((s): Target => {
    switch (verdict) {
      case 'up':
        return { weight: stepUp(s.weight, known, step), reps: repMin };
      case 'down':
        return { weight: stepDown(s.weight, known, step), reps: repMin };
      case 'retry':
        // Retried, never lowered to what was done.
        return { weight: s.weight, reps: s.targetReps ?? s.reps };
      case 'progress':
        return { weight: s.weight, reps: noPlusOne ? s.reps : Math.min(s.reps + 1, repMax) };
    }
  });
  // The lone set gets the common weight and the same target as the others (the lowest when they differ).
  if (loneIndex !== null) {
    targets.splice(loneIndex, 0, { weight: targets[0].weight, reps: Math.min(...targets.map((t) => t.reps)) });
  }

  // The exercise's set count changed: added sets copy the last set's target, removed ones are dropped.
  return Array.from({ length: setCount }, (_, i) => targets[Math.min(i, targets.length - 1)]);
}

/** nextTargets from the history of an exercise: its last finished sessions, most recent first (up to three). */
export function targetsFromHistory(
  history: ExerciseLog[],
  input: Omit<NextTargetsInput, 'last' | 'previous' | 'beforePrevious'>,
): Target[] | null {
  return nextTargets({
    ...input,
    last: history[0] ?? null,
    previous: history[1] ?? null,
    beforePrevious: history[2] ?? null,
  });
}
