import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { WorkoutsController } from './../src/workouts/workouts.controller.js';
import { WorkoutsService } from './../src/workouts/workouts.service.js';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ROWING = uuid(1);
const CURL = uuid(2);
const BENCH = uuid(3);

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
}
interface Workout {
  id: string;
  name: string;
  position: number;
}

/** In-memory stand-in for Workout / WorkoutItem / Exercise, enough for WorkoutsService. */
function fakePrisma() {
  const exercises = [exercise(ROWING, 'Rowing barre'), exercise(CURL, 'Curl haltères'), exercise(BENCH, 'Développé couché barre')];
  const workouts: Workout[] = [];
  let items: Item[] = [];
  let next = 100;
  const withItems = (w: Workout) => {
    const own = items.filter((i) => i.workoutId === w.id).sort((a, b) => a.position - b.position);
    return {
      ...w,
      items: own.map((i) => {
        const ex = exercises.find((e) => e.id === i.exerciseId)!;
        const workoutItems = items
          .filter((x) => x.exerciseId === ex.id)
          .map((x) => ({ ...x, workout: workouts.find((o) => o.id === x.workoutId)! }));
        return { ...i, exercise: { ...ex, workoutItems } };
      }),
    };
  };
  const addItems = (workoutId: string, create: Omit<Item, 'workoutId'>[]) => {
    items.push(...create.map((c) => ({ ...c, workoutId })));
  };
  return {
    workouts,
    workout: {
      findMany: () => Promise.resolve([...workouts].sort((a, b) => a.position - b.position).map(withItems)),
      findUnique: ({ where }: { where: { id: string } }) => {
        const w = workouts.find((x) => x.id === where.id);
        return Promise.resolve(w ? withItems(w) : null);
      },
      aggregate: () =>
        Promise.resolve({ _max: { position: workouts.length ? Math.max(...workouts.map((w) => w.position)) : null } }),
      create: ({ data }: { data: { name: string; position: number; items: { create: Omit<Item, 'workoutId'>[] } } }) => {
        const w = { id: uuid(next++), name: data.name, position: data.position };
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
        workouts.splice(workouts.findIndex((x) => x.id === where.id), 1);
        items = items.filter((i) => i.workoutId !== where.id);
        return Promise.resolve();
      },
      updateMany: ({ where }: { where: { position: { gt: number } } }) => {
        for (const w of workouts) if (w.position > where.position.gt) w.position--;
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
    // The fake runs each operation when it is built: just wait for them.
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
}

const item = (exerciseId: string, sets = 4, repMin = 8, repMax = 12) => ({ exerciseId, sets, repMin, repMax });

describe('Workouts (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkoutsController],
      providers: [WorkoutsService, { provide: PrismaService, useValue: fakePrisma() }],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
    configureApp(app);
    await app.init();
  });
  afterAll(() => app.close());

  it('adds workouts at the end of the rotation; the first one is next until a session is done', async () => {
    const pushA = await http().post('/api/workouts').send({ name: ' Push A ', items: [item(BENCH)] }).expect(201);
    expect(pushA.body).toMatchObject({ name: 'Push A', position: 1 });
    await http().post('/api/workouts').send({ name: 'Pull', items: [item(ROWING), item(CURL, 3, 10, 15)] }).expect(201);
    await http().post('/api/workouts').send({ name: 'Push B', items: [] }).expect(201);

    const list = await http().get('/api/workouts').expect(200);
    expect(list.body).toEqual([
      { id: pushA.body.id, name: 'Push A', position: 1, exerciseNames: ['Développé couché barre'], lastDoneOn: null, isNext: true },
      expect.objectContaining({ name: 'Pull', position: 2, exerciseNames: ['Rowing barre', 'Curl haltères'], isNext: false }),
      expect.objectContaining({ name: 'Push B', position: 3, exerciseNames: [], isNext: false }),
    ]);
  });

  it('returns a workout with its exercises in order, and the exercise knows its workouts', async () => {
    const pull = (await http().get('/api/workouts').expect(200)).body[1];
    const res = await http().get(`/api/workouts/${pull.id}`).expect(200);
    expect(res.body.items.map((i: { exercise: { name: string }; sets: number }) => [i.exercise.name, i.sets])).toEqual([
      ['Rowing barre', 4],
      ['Curl haltères', 3],
    ]);
    expect(res.body.items[1]).toMatchObject({ repMin: 10, repMax: 15 });
    expect(res.body.items[0].exercise.workouts).toEqual([{ id: pull.id, name: 'Pull', sets: 4, repMin: 8, repMax: 12 }]);
  });

  it('replaces name and exercises (new order) on edit', async () => {
    const pull = (await http().get('/api/workouts').expect(200)).body[1];
    const res = await http()
      .put(`/api/workouts/${pull.id}`)
      .send({ name: 'Tirage', items: [item(CURL, 4, 8, 12), item(ROWING, 5, 6, 8)] })
      .expect(200);
    expect(res.body.name).toBe('Tirage');
    expect(res.body.items.map((i: { exercise: { id: string }; sets: number }) => [i.exercise.id, i.sets])).toEqual([
      [CURL, 4],
      [ROWING, 5],
    ]);
  });

  it('rejects a duplicate or unknown exercise, a bad rep range or set count', async () => {
    const post = (items: object[]) => http().post('/api/workouts').send({ name: 'X', items });
    await post([item(ROWING), item(ROWING)]).expect(400);
    await post([item(uuid(999))]).expect(400);
    await post([item(ROWING, 4, 12, 8)]).expect(400);
    await post([item(ROWING, 0)]).expect(400);
    await post([item(ROWING, 11)]).expect(400);
    await http().post('/api/workouts').send({ name: '  ', items: [] }).expect(400);
    await http().get(`/api/workouts/${uuid(999)}`).expect(404);
  });

  it('deletes a workout and moves the next ones up', async () => {
    const [pushA] = (await http().get('/api/workouts').expect(200)).body;
    await http().delete(`/api/workouts/${pushA.id}`).expect(204);
    const list = await http().get('/api/workouts').expect(200);
    expect(list.body.map((w: { name: string; position: number }) => [w.name, w.position])).toEqual([
      ['Tirage', 1],
      ['Push B', 2],
    ]);
    expect(list.body[0].isNext).toBe(true);
    await http().delete(`/api/workouts/${pushA.id}`).expect(404);
  });
});
