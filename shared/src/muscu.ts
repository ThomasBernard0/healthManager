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
  /** kg (0 for body weight without added load). */
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
