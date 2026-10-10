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
