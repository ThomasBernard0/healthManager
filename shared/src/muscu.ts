/** Musculation: equipment and muscles of an exercise (same values as the Prisma enums). */
export const EQUIPMENTS = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'] as const;
export type Equipment = (typeof EQUIPMENTS)[number];

/** Display order: upper body front to back, arms, core, legs. */
export const MUSCLES = [
  'chest',
  'back',
  'shoulders_front',
  'shoulders_side',
  'shoulders_rear',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
] as const;
export type Muscle = (typeof MUSCLES)[number];

/**
 * The next workout of the rotation: the one after the workout of the last finished session, in
 * `position` order, wrapping around. No session yet (or its workout was deleted) → the first one.
 */
export function nextWorkout<W extends { id: string; position: number }>(
  workouts: W[],
  lastFinishedWorkoutId: string | null,
): W | null {
  const ordered = [...workouts].sort((a, b) => a.position - b.position);
  if (ordered.length === 0) return null;
  const last = ordered.findIndex((w) => w.id === lastFinishedWorkoutId);
  return ordered[last === -1 ? 0 : (last + 1) % ordered.length];
}

export interface SetResult {
  /** kg (0 for body weight without added load, < 0 for help from an assisted machine). */
  weight: number;
  reps: number;
}

export interface SetGroup {
  weight: number;
  reps: number[];
}

/**
 * Compact set format: consecutive sets at the same weight are grouped, a weight change starts a new
 * group. 60×10, 60×9, 60×9, 60×8 → [{ 60, [10, 9, 9, 8] }] ("60 kg × 10 · 9 · 9 · 8").
 */
export function groupSets(sets: SetResult[]): SetGroup[] {
  const groups: SetGroup[] = [];
  for (const set of sets) {
    const last = groups[groups.length - 1];
    if (last && last.weight === set.weight) last.reps.push(set.reps);
    else groups.push({ weight: set.weight, reps: [set.reps] });
  }
  return groups;
}

/** Σ weight × reps (kg). */
export const volume = (sets: SetResult[]): number => sets.reduce((sum, s) => sum + s.weight * s.reps, 0);

/**
 * Line of the Progression chart: the average weight weighted by reps, Σ weight × reps / Σ reps (signed: help < 0).
 * Sets without any rep: the first set's weight.
 */
export function averageWeight(sets: SetResult[]): number {
  const reps = sets.reduce((sum, s) => sum + s.reps, 0);
  return reps === 0 ? (sets[0]?.weight ?? 0) : volume(sets) / reps;
}

/** What a chart bar of an exercise shows: its volume, or its total reps when the weight is not the whole load. */
export const BAR_KINDS = ['volume', 'reps'] as const;
export type BarKind = (typeof BAR_KINDS)[number];

export const barKind = (equipment: Equipment): BarKind => (equipment === 'bodyweight' ? 'reps' : 'volume');

/** Value of a chart bar: Σ weight × reps, or Σ reps for a bodyweight exercise (0 kg or help is not a zero bar). */
export const chartBarValue = (sets: SetResult[], equipment: Equipment): number =>
  barKind(equipment) === 'reps' ? sets.reduce((sum, s) => sum + s.reps, 0) : volume(sets);

/** How a weight reads: help from an assisted machine (< 0), the body alone (0 on a bodyweight exercise), or a load. */
export type LoadKind = 'assist' | 'bodyweight' | 'load';

export function loadKind(weight: number, bodyweight: boolean): LoadKind {
  if (weight < 0) return 'assist';
  return weight === 0 && bodyweight ? 'bodyweight' : 'load';
}

export interface InterleavedSet<T> {
  /** 'a': first exercise of the superset, 'b': second. */
  exercise: 'a' | 'b';
  /** Index of the set in its own exercise, from 0. */
  index: number;
  set: T;
}

/**
 * Order of the sets of a superset: alternately while both exercises have sets left, then the rest of
 * the longer one. 4 + 3 sets → A1 B1 A2 B2 A3 B3 A4.
 */
export function interleaveSets<T>(a: T[], b: T[]): InterleavedSet<T>[] {
  const order: InterleavedSet<T>[] = [];
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    if (index < a.length) order.push({ exercise: 'a', index, set: a[index] });
    if (index < b.length) order.push({ exercise: 'b', index, set: b[index] });
  }
  return order;
}

/**
 * Superset groups of a workout, given the group of each item in list order (null: solo): every group
 * has exactly two items, next to each other.
 */
export function validSupersetGroups(groups: (string | null)[]): boolean {
  const seen = new Set<string>();
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    if (group === null) continue;
    if (seen.has(group) || groups[i + 1] !== group) return false;
    seen.add(group);
    i++;
  }
  return true;
}

interface InGroup {
  /** Superset group (null: solo). */
  group: string | null;
}

/** The exercises of a workout or a session cut in blocks: the two consecutive ones of a superset, or one alone. */
export function toBlocks<T extends InGroup>(items: T[]): T[][] {
  const blocks: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const paired = items[i].group !== null && items[i + 1]?.group === items[i].group;
    blocks.push(paired ? [items[i], items[i + 1]] : [items[i]]);
    if (paired) i++;
  }
  return blocks;
}

/** Délier: both exercises stay where they are, with their sets and rep range. */
export function unlinkSuperset<T extends InGroup>(items: T[], group: string): T[] {
  return items.map((item) => (item.group === group ? { ...item, group: null } : item));
}

export type ExerciseStatus = 'todo' | 'inProgress' | 'done';

/** One status for a block of a session: done only when every exercise is, in progress once one is started. */
export function blockStatus(statuses: ExerciseStatus[]): ExerciseStatus {
  if (statuses.every((s) => s === 'done')) return 'done';
  return statuses.every((s) => s === 'todo') ? 'todo' : 'inProgress';
}
