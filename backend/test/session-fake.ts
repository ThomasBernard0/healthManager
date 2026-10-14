import { DIPS_THEN_BENCH, type FixtureExercise } from '@healthmanager/shared/testing';

export const SESSION = '00000000-0000-4000-8000-000000000101';
export const DIPS_ENTRY = '00000000-0000-4000-8000-000000000102';
export const BENCH_ENTRY = '00000000-0000-4000-8000-000000000103';
const DIPS = '00000000-0000-4000-8000-000000000104';
const BENCH = '00000000-0000-4000-8000-000000000105';

interface FakeSet {
  id: string;
  index: number;
  targetWeight: number | null;
  targetReps: number | null;
  weight: number | null;
  reps: number | null;
  done: boolean;
  doneAt: Date | null;
}

const exerciseRow = (id: string, e: FixtureExercise) => ({
  id,
  name: e.name,
  equipment: e.equipment,
  primaryMuscles: e.primaryMuscles,
  secondaryMuscles: e.secondaryMuscles,
  sets: e.sets,
  repMin: e.repMin,
  repMax: e.repMax,
  image: null,
  workoutItems: [],
});

const entryRow = (id: string, exerciseId: string, position: number, e: FixtureExercise) => ({
  id,
  sessionId: SESSION,
  exerciseId,
  position,
  repMin: e.repMin,
  repMax: e.repMax,
  supersetGroup: null as string | null,
  easy: false,
  completed: false,
  firstSetAt: null as Date | null,
  preFatigue: null as number | null,
  exercise: exerciseRow(exerciseId, e),
  sets: Array.from(
    { length: e.sets },
    (_, index): FakeSet => ({
      id: `${id}-${index}`,
      index,
      targetWeight: null,
      targetReps: null,
      weight: null,
      reps: null,
      done: false,
      doneAt: null,
    }),
  ),
});

/**
 * In-memory stand-in for the Session tables: Push with Dips then Développé couché (the shared fixture), not
 * started. Enough for the bundle and Terminer (both run against Postgres in production).
 */
export function fakeSessionPrisma() {
  let session: { id: string; workoutId: string; workoutName: string; startedAt: Date; finishedAt: Date | null } | null =
    { id: SESSION, workoutId: '00000000-0000-4000-8000-000000000106', workoutName: 'Push', startedAt: new Date(), finishedAt: null };
  let entries = [
    entryRow(DIPS_ENTRY, DIPS, 0, DIPS_THEN_BENCH.dips),
    entryRow(BENCH_ENTRY, BENCH, 1, DIPS_THEN_BENCH.bench),
  ];
  const withSession = () => (session ? { ...session, exercises: entries } : null);

  const prisma = {
    /** The session as stored (null once deleted). */
    get stored() {
      return withSession();
    },
    session: {
      findUnique: () => Promise.resolve(withSession()),
      update: ({ data }: { data: { finishedAt: Date } }) => {
        Object.assign(session!, data);
        return Promise.resolve(session);
      },
      delete: () => {
        session = null;
        entries = [];
        return Promise.resolve();
      },
    },
    sessionSet: {
      update: ({ where, data }: { where: { id: string }; data: Partial<FakeSet> }) => {
        const set = entries.flatMap((e) => e.sets).find((s) => s.id === where.id)!;
        Object.assign(set, data);
        return Promise.resolve(set);
      },
    },
    sessionExercise: {
      findMany: () => Promise.resolve(entries),
      update: ({ where, data }: { where: { id: string }; data: object }) => {
        const entry = entries.find((e) => e.id === where.id)!;
        Object.assign(entry, data);
        return Promise.resolve(entry);
      },
      deleteMany: ({ where }: { where: { id: { notIn: string[] } } }) => {
        entries = entries.filter((e) => where.id.notIn.includes(e.id));
        return Promise.resolve();
      },
      updateMany: ({ where, data }: { where: { id: { in: string[] } }; data: object }) => {
        for (const e of entries) if (where.id.in.includes(e.id)) Object.assign(e, data);
        return Promise.resolve();
      },
    },
    $transaction: <T>(run: (tx: unknown) => Promise<T>) => run(prisma),
  };
  return prisma;
}

/** The history and known weights of the fixture, by exercise id. */
export function fakeProgression() {
  const byId = (id: string) => (id === BENCH ? DIPS_THEN_BENCH.bench : DIPS_THEN_BENCH.dips);
  return {
    history: (id: string) => Promise.resolve(byId(id).history),
    knownWeights: (id: string) => Promise.resolve(byId(id).known),
  };
}
