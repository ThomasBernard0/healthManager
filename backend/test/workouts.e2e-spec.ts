import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { ProgressionService } from './../src/sessions/progression.service.js';
import { WorkoutsController } from './../src/workouts/workouts.controller.js';
import { WorkoutsService } from './../src/workouts/workouts.service.js';
import { BENCH, CURL, FIRST_PROGRAM, ROWING, fakePrisma, item, uuid } from './muscu-fake.js';

describe('Workouts (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkoutsController],
      providers: [
        WorkoutsService,
        { provide: PrismaService, useValue: fakePrisma() },
        // First time for every exercise: no target.
        { provide: ProgressionService, useValue: { targets: () => Promise.resolve(null) } },
      ],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
    configureApp(app);
    await app.init();
  });
  afterAll(() => app.close());

  it('adds workouts at the end of the active program rotation; the first one is next until a session is done', async () => {
    const pushA = await http().post('/api/workouts').send({ name: ' Push A ', items: [item(BENCH)] }).expect(201);
    expect(pushA.body).toMatchObject({ name: 'Push A', position: 1 });
    await http().post('/api/workouts').send({ name: 'Pull', items: [item(ROWING), item(CURL)] }).expect(201);
    await http().post('/api/workouts').send({ name: 'Push B', items: [] }).expect(201);

    const list = await http().get('/api/workouts').expect(200);
    expect(list.body).toEqual([
      {
        id: pushA.body.id,
        name: 'Push A',
        position: 1,
        exercises: [{ name: 'Développé couché barre', targets: null }],
        lastDoneOn: null,
        isNext: true,
      },
      expect.objectContaining({
        name: 'Pull',
        position: 2,
        exercises: [
          { name: 'Rowing barre', targets: null },
          { name: 'Curl haltères', targets: null },
        ],
        isNext: false,
      }),
      expect.objectContaining({ name: 'Push B', position: 3, exercises: [], isNext: false }),
    ]);
  });

  it('returns a workout with its exercises in order (each with its own scheme), and the exercise knows its workouts', async () => {
    const pull = (await http().get('/api/workouts').expect(200)).body[1];
    const res = await http().get(`/api/workouts/${pull.id}`).expect(200);
    expect(res.body.items.map((i: { exercise: { name: string; sets: number } }) => [i.exercise.name, i.exercise.sets])).toEqual([
      ['Rowing barre', 4],
      ['Curl haltères', 3],
    ]);
    expect(res.body).toMatchObject({ programId: FIRST_PROGRAM, programActive: true });
    expect(res.body.items[1].exercise).toMatchObject({ repMin: 10, repMax: 15 });
    expect(res.body.items[1]).not.toHaveProperty('sets');
    expect(res.body.items[0].exercise.workouts).toEqual([
      { id: pull.id, name: 'Pull', programId: FIRST_PROGRAM, programActive: true },
    ]);
  });

  it('replaces name and exercises (new order) on edit', async () => {
    const pull = (await http().get('/api/workouts').expect(200)).body[1];
    const res = await http()
      .put(`/api/workouts/${pull.id}`)
      .send({ name: 'Tirage', items: [item(CURL), item(ROWING)] })
      .expect(200);
    expect(res.body.name).toBe('Tirage');
    expect(res.body.items.map((i: { exercise: { id: string } }) => i.exercise.id)).toEqual([CURL, ROWING]);
  });

  it('rejects a duplicate or unknown exercise, and sets or a rep range on an item (they belong to the exercise)', async () => {
    const post = (items: object[]) => http().post('/api/workouts').send({ name: 'X', items });
    await post([item(ROWING), item(ROWING)]).expect(400);
    await post([item(uuid(999))]).expect(400);
    await post([{ ...item(ROWING), sets: 4 }]).expect(400);
    await post([{ ...item(ROWING), repMin: 8, repMax: 12 }]).expect(400);
    await http().post('/api/workouts').send({ name: '  ', items: [] }).expect(400);
    await http().post('/api/workouts').send({ name: 'X', programId: uuid(999), items: [] }).expect(400);
    await http().get(`/api/workouts/${uuid(999)}`).expect(404);
  });

  it('links two adjacent exercises in a superset (own uuid per pair) and unlinks them', async () => {
    const linked = [{ ...item(BENCH), group: 'x' }, { ...item(CURL), group: 'x' }, item(ROWING)];
    const created = await http().post('/api/workouts').send({ name: 'Superset', items: linked }).expect(201);
    const [a, b, solo] = created.body.items;
    expect(a.group).toMatch(/^[0-9a-f-]{36}$/);
    expect(b.group).toBe(a.group);
    expect(solo.group).toBeNull();

    // The same exercise has the same scheme in every workout.
    expect([b.exercise.sets, b.exercise.repMin, b.exercise.repMax]).toEqual([3, 10, 15]);
    expect(b.exercise.workouts.map((w: { name: string }) => w.name)).toContain('Superset');

    // Unlinking keeps both exercises, their scheme and their order.
    const unlinked = linked.map(({ exerciseId }) => ({ exerciseId }));
    const res = await http().put(`/api/workouts/${created.body.id}`).send({ name: 'Superset', items: unlinked }).expect(200);
    expect(
      res.body.items.map(
        (i: { exercise: { id: string; sets: number; repMin: number; repMax: number }; group: string | null }) => [
          i.exercise.id,
          i.exercise.sets,
          i.exercise.repMin,
          i.exercise.repMax,
          i.group,
        ],
      ),
    ).toEqual([
      [BENCH, 4, 8, 12, null],
      [CURL, 3, 10, 15, null],
      [ROWING, 4, 8, 12, null],
    ]);
    await http().delete(`/api/workouts/${created.body.id}`).expect(204);
  });

  it('rejects a superset of 3 exercises, of 1, or of two exercises that are not adjacent', async () => {
    const post = (groups: (string | null)[]) =>
      http()
        .post('/api/workouts')
        .send({ name: 'X', items: [BENCH, CURL, ROWING].map((id, k) => ({ ...item(id), group: groups[k] })) });
    await post(['x', 'x', 'x']).expect(400);
    await post(['x', null, null]).expect(400);
    await post(['x', null, 'x']).expect(400);
    await post(['', '', null]).expect(400);
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
