import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/app.setup.js';
import { ExercisesController } from './../src/exercises/exercises.controller.js';
import { ExercisesService } from './../src/exercises/exercises.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

type Row = Record<string, unknown> & { id: string };

/** In-memory stand-in for the Exercise table. */
function fakePrisma() {
  const rows: Row[] = [];
  const find = (id: string) => rows.find((r) => r.id === id) ?? null;
  return {
    rows,
    // Finished sessions of Rowing barre, most recent first (as the query orders them).
    sessionExercise: {
      findMany: ({ where }: { where: { exerciseId: string } }) =>
        Promise.resolve(
          where.exerciseId !== '00000000-0000-4000-8000-000000000001'
            ? []
            : [
                {
                  sessionId: 's2',
                  session: { finishedAt: new Date('2026-09-28T18:30:00Z') },
                  feeling: 'ok',
                  preFatigue: 3,
                  supersetGroup: 'g1',
                  sets: [10, 9, 9, 8].map((reps) => ({ weight: 60, reps })),
                },
                {
                  sessionId: 's1',
                  session: { finishedAt: new Date('2026-09-14T22:30:00Z') },
                  feeling: null,
                  preFatigue: null,
                  supersetGroup: null,
                  sets: [
                    { weight: 57.5, reps: 11 },
                    { weight: 57.5, reps: 10 },
                    { weight: 55, reps: 10 },
                    { weight: 55, reps: 9 },
                  ],
                },
              ],
        ),
    },
    exercise: {
      findMany: ({ where }: { where: { archived: boolean } }) =>
        Promise.resolve(rows.filter((r) => r.archived === where.archived)),
      findUnique: ({ where }: { where: { id: string } }) => Promise.resolve(find(where.id)),
      create: ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `00000000-0000-4000-8000-0000000000${10 + rows.length}`, archived: false, image: null, workoutItems: [], ...data };
        rows.push(row);
        return Promise.resolve(row);
      },
      update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve(Object.assign(find(where.id)!, data)),
    },
  };
}

describe('Exercises (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: ReturnType<typeof fakePrisma>;

  beforeAll(async () => {
    prisma = fakePrisma();
    prisma.rows.push(
      {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Rowing barre',
        searchName: 'rowing barre',
        equipment: 'barbell',
        primaryMuscles: ['back'],
        secondaryMuscles: ['biceps', 'shoulders_rear'],
        image: 'rowing-barre.svg',
        archived: false,
        workoutItems: [],
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Écarté poulie vis-à-vis',
        searchName: 'ecarte poulie vis-a-vis',
        equipment: 'cable',
        primaryMuscles: ['chest'],
        secondaryMuscles: [],
        image: 'ecarte-poulie.svg',
        archived: false,
        workoutItems: [],
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        name: 'Ancien',
        searchName: 'ancien',
        equipment: 'machine',
        primaryMuscles: ['chest'],
        secondaryMuscles: [],
        image: null,
        archived: true,
        workoutItems: [],
      },
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [ExercisesController],
      providers: [ExercisesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
    configureApp(app);
    await app.init();
  });
  afterAll(() => app.close());

  it('lists the bank by name, without archived exercises, with the image path', async () => {
    const res = await request(app.getHttpServer()).get('/api/exercises').expect(200);
    expect(res.body.map((e: { name: string }) => e.name)).toEqual(['Écarté poulie vis-à-vis', 'Rowing barre']);
    expect(res.body[1]).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Rowing barre',
      equipment: 'barbell',
      primaryMuscles: ['back'],
      secondaryMuscles: ['biceps', 'shoulders_rear'],
      imageUrl: '/exercises/rowing-barre.svg',
      workouts: [],
    });
  });

  it('searches accent/case-insensitively', async () => {
    const res = await request(app.getHttpServer()).get('/api/exercises?q=ECARTE vis').expect(200);
    expect(res.body.map((e: { name: string }) => e.name)).toEqual(['Écarté poulie vis-à-vis']);
  });

  it('creates and edits a custom exercise (no image)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/exercises')
      .send({ name: ' Pull-over ', equipment: 'dumbbell', primaryMuscles: ['back'], secondaryMuscles: ['chest'] })
      .expect(201);
    expect(created.body).toMatchObject({ name: 'Pull-over', imageUrl: null });

    const updated = await request(app.getHttpServer())
      .put(`/api/exercises/${created.body.id}`)
      .send({ name: 'Pull-over haltère', equipment: 'dumbbell', primaryMuscles: ['chest'], secondaryMuscles: [] })
      .expect(200);
    expect(updated.body).toMatchObject({ name: 'Pull-over haltère', primaryMuscles: ['chest'], secondaryMuscles: [] });
  });

  it('returns the history: Paris date, sets, feeling, pre-fatigue, volume, heaviest weight', async () => {
    const res = await request(app.getHttpServer()).get('/api/exercises/00000000-0000-4000-8000-000000000001/history').expect(200);
    expect(res.body).toEqual([
      {
        sessionId: 's2',
        date: '2026-09-28',
        sets: [10, 9, 9, 8].map((reps) => ({ weight: 60, reps })),
        feeling: 'ok',
        preFatigue: 3,
        inSuperset: true,
        volume: 2160,
        heaviest: 60,
      },
      {
        sessionId: 's1',
        // 22:30 UTC is already the next day in Paris.
        date: '2026-09-15',
        sets: [
          { weight: 57.5, reps: 11 },
          { weight: 57.5, reps: 10 },
          { weight: 55, reps: 10 },
          { weight: 55, reps: 9 },
        ],
        feeling: null,
        preFatigue: 0,
        inSuperset: false,
        volume: 2252.5,
        heaviest: 57.5,
      },
    ]);
    await request(app.getHttpServer()).get('/api/exercises/00000000-0000-4000-8000-000000000099/history').expect(404);
  });

  it('rejects a muscle twice, no primary muscle, or unknown values', async () => {
    const base = { name: 'X', equipment: 'machine', primaryMuscles: ['chest'], secondaryMuscles: [] };
    const post = (body: object) => request(app.getHttpServer()).post('/api/exercises').send({ ...base, ...body });
    await post({ secondaryMuscles: ['chest'] }).expect(400);
    await post({ primaryMuscles: [] }).expect(400);
    await post({ primaryMuscles: ['lats'] }).expect(400);
    await post({ equipment: 'kettlebell' }).expect(400);
    await post({ name: '   ' }).expect(400);
    await request(app.getHttpServer()).get('/api/exercises/00000000-0000-4000-8000-000000000099').expect(404);
  });
});
