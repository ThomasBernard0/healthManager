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
