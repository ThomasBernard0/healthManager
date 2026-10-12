export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const ROWING = uuid(1);
export const CURL = uuid(2);
export const BENCH = uuid(3);
/** The program created by the migration. */
export const FIRST_PROGRAM = uuid(10);

const exercise = (id: string, name: string) => ({
  id,
  name,
  searchName: name.toLowerCase(),
  equipment: 'barbell',
  primaryMuscles: ['back'],
  secondaryMuscles: [],
  image: null,
  archived: false,
});

interface Item {
  workoutId: string;
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  position: number;
  supersetGroup: string | null;
}
interface Workout {
  id: string;
  name: string;
  programId: string;
  position: number;
}
interface Program {
  id: string;
  name: string;
  position: number;
  active: boolean;
  activatedAt: Date;
}
interface FinishedSession {
  workoutId: string;
  finishedAt: Date;
}

type Where = Record<string, unknown> & { id?: string | { not: string } };

/** In-memory stand-in for Program / Workout / WorkoutItem / Exercise / finished sessions. */
export function fakePrisma() {
  const exercises = [exercise(ROWING, 'Rowing barre'), exercise(CURL, 'Curl haltères'), exercise(BENCH, 'Développé couché barre')];
  const programs: Program[] = [
    { id: FIRST_PROGRAM, name: 'Mon programme', position: 1, active: true, activatedAt: new Date(0) },
  ];
  let workouts: Workout[] = [];
  let items: Item[] = [];
  const sessions: FinishedSession[] = [];
  let next = 100;
  // Finishing and activating in the same millisecond: a clock that always moves forward.
  let now = Date.now();
  const tick = () => new Date(++now);

  const programOf = (w: Workout) => programs.find((p) => p.id === w.programId)!;
  const withItems = (w: Workout) => {
    const own = items.filter((i) => i.workoutId === w.id).sort((a, b) => a.position - b.position);
    return {
      ...w,
      program: programOf(w),
      items: own.map((i) => {
        const ex = exercises.find((e) => e.id === i.exerciseId)!;
        const workoutItems = items.filter((x) => x.exerciseId === ex.id).map((x) => {
          const workout = workouts.find((o) => o.id === x.workoutId)!;
          return { ...x, workout: { ...workout, program: programOf(workout) } };
        });
        return { ...i, exercise: { ...ex, workoutItems } };
      }),
    };
  };
  const addItems = (workoutId: string, create: Omit<Item, 'workoutId'>[]) => {
    items.push(...create.map((c) => ({ ...c, workoutId })));
  };
  const maxPosition = (list: { position: number }[]) => ({
    _max: { position: list.length ? Math.max(...list.map((x) => x.position)) : null },
  });
  const matchesProgram = (p: Program, where: Where) =>
    (where.active === undefined || p.active === where.active) &&
    (where.id === undefined || (typeof where.id === 'string' ? p.id === where.id : p.id !== where.id.not));
  const sessionsIn = (where: { workoutId: { in: string[] }; finishedAt?: { gte?: Date } }) =>
    sessions.filter(
      (s) => where.workoutId.in.includes(s.workoutId) && (!where.finishedAt?.gte || s.finishedAt >= where.finishedAt.gte),
    );

  return {
    /** A session of this workout finished now. */
    finish: (workoutId: string) => sessions.push({ workoutId, finishedAt: tick() }),
    program: {
      findFirst: ({ where }: { where: Where }) => Promise.resolve(programs.find((p) => matchesProgram(p, where)) ?? null),
      findUnique: ({ where }: { where: { id: string } }) => Promise.resolve(programs.find((p) => p.id === where.id) ?? null),
      findMany: () =>
        Promise.resolve(
          [...programs]
            .sort((a, b) => Number(b.active) - Number(a.active) || a.position - b.position)
            .map((p) => ({ ...p, _count: { workouts: workouts.filter((w) => w.programId === p.id).length } })),
        ),
      aggregate: () => Promise.resolve(maxPosition(programs)),
      create: ({ data }: { data: { name: string; position: number } }) => {
        const p = { id: uuid(next++), ...data, active: false, activatedAt: tick() };
        programs.push(p);
        return Promise.resolve(p);
      },
      update: ({ where, data }: { where: { id: string }; data: Partial<Program> }) => {
        const p = programs.find((x) => x.id === where.id)!;
        Object.assign(p, data, data.activatedAt ? { activatedAt: tick() } : {});
        return Promise.resolve(p);
      },
      updateMany: ({ where, data }: { where: Where & { position?: { gt: number } }; data: Record<string, unknown> }) => {
        for (const p of programs) {
          if (where.position) {
            if (p.position > where.position.gt) p.position--;
          } else if (matchesProgram(p, where)) Object.assign(p, data);
        }
        return Promise.resolve();
      },
      delete: ({ where }: { where: { id: string } }) => {
        programs.splice(programs.findIndex((x) => x.id === where.id), 1);
        const gone = workouts.filter((w) => w.programId === where.id).map((w) => w.id);
        workouts = workouts.filter((w) => w.programId !== where.id);
        items = items.filter((i) => !gone.includes(i.workoutId));
        return Promise.resolve();
      },
    },
    workout: {
      findMany: ({ where }: { where: { programId: string } }) =>
        Promise.resolve(
          workouts
            .filter((w) => w.programId === where.programId)
            .sort((a, b) => a.position - b.position)
            .map(withItems),
        ),
      findUnique: ({ where }: { where: { id: string } }) => {
        const w = workouts.find((x) => x.id === where.id);
        return Promise.resolve(w ? withItems(w) : null);
      },
      aggregate: ({ where }: { where: { programId: string } }) =>
        Promise.resolve(maxPosition(workouts.filter((w) => w.programId === where.programId))),
      create: ({
        data,
      }: {
        data: { name: string; programId: string; position: number; items: { create: Omit<Item, 'workoutId'>[] } };
      }) => {
        const w = { id: uuid(next++), name: data.name, programId: data.programId, position: data.position };
        workouts.push(w);
        addItems(w.id, data.items.create);
        return Promise.resolve(w);
      },
      update: ({ where, data }: { where: { id: string }; data: { name: string; items: { create: Omit<Item, 'workoutId'>[] } } }) => {
        const w = workouts.find((x) => x.id === where.id)!;
        w.name = data.name;
        addItems(w.id, data.items.create);
        return Promise.resolve(w);
      },
      delete: ({ where }: { where: { id: string } }) => {
        workouts = workouts.filter((x) => x.id !== where.id);
        items = items.filter((i) => i.workoutId !== where.id);
        return Promise.resolve();
      },
      updateMany: ({ where }: { where: { programId: string; position: { gt: number } } }) => {
        for (const w of workouts) if (w.programId === where.programId && w.position > where.position.gt) w.position--;
        return Promise.resolve();
      },
    },
    workoutItem: {
      deleteMany: ({ where }: { where: { workoutId: string } }) => {
        items = items.filter((i) => i.workoutId !== where.workoutId);
        return Promise.resolve();
      },
    },
    exercise: {
      count: ({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(exercises.filter((e) => where.id.in.includes(e.id)).length),
    },
    session: {
      groupBy: ({ where }: { where: { workoutId: { in: string[] } } }) => {
        const last = new Map<string, Date>();
        for (const s of sessionsIn(where)) {
          if (!last.has(s.workoutId) || s.finishedAt > last.get(s.workoutId)!) last.set(s.workoutId, s.finishedAt);
        }
        return Promise.resolve([...last].map(([workoutId, finishedAt]) => ({ workoutId, _max: { finishedAt } })));
      },
      findFirst: ({ where }: { where: { workoutId: { in: string[] }; finishedAt: { gte: Date } } }) => {
        const found = sessionsIn(where);
        return Promise.resolve(found.length ? found.reduce((a, b) => (b.finishedAt >= a.finishedAt ? b : a)) : null);
      },
    },
    // The fake runs each operation when it is built: just wait for them.
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
}

export const item = (exerciseId: string, sets = 4, repMin = 8, repMax = 12) => ({ exerciseId, sets, repMin, repMax });
