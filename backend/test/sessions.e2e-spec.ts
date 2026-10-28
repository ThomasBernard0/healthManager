import { DIPS_THEN_BENCH } from '@healthmanager/shared/testing';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { ProgressionService } from './../src/sessions/progression.service.js';
import { SessionsController } from './../src/sessions/sessions.controller.js';
import { SessionsService } from './../src/sessions/sessions.service.js';
import { BENCH_ENTRY, DIPS_ENTRY, fakeProgression, fakeSessionPrisma, SESSION } from './session-fake.js';

const S = '00000000-0000-4000-8000-000000000001';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 14, 17, minute)).toISOString();
const done = (index: number, weight: number, reps: number, minute: number, target: [number, number] | null = null) => ({
  index,
  targetWeight: target?.[0] ?? null,
  targetReps: target?.[1] ?? null,
  weight,
  reps,
  done: true,
  doneAt: at(minute),
});
const todo = (index: number) => ({ index, targetWeight: null, targetReps: null, weight: null, reps: null, done: false, doneAt: null });

/** 3 sets of Dips, then 2 sets of Développé couché (targets from the phone), then stopped. */
const body = {
  exercises: [
    { id: DIPS_ENTRY, easy: true, completed: true, sets: [done(0, 0, 10, 0), done(1, 0, 9, 3), done(2, 0, 8, 6)] },
    {
      id: BENCH_ENTRY,
      easy: false,
      completed: true,
      sets: [done(0, 60, 10, 10, [60, 10]), done(1, 60, 9, 14, [60, 10]), todo(2), todo(3)],
    },
  ],
};

// Routing, validation and the service against an in-memory stand-in of the session tables.
describe('Sessions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: ReturnType<typeof fakeSessionPrisma>;
  const http = () => request(app.getHttpServer());
  const finish = (b: object = body) => http().post(`/api/sessions/${SESSION}/finish`).send(b);

  beforeEach(async () => {
    prisma = fakeSessionPrisma();
    const moduleRef = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProgressionService, useValue: fakeProgression() },
      ],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
    configureApp(app);
    await app.init();
  });
  afterEach(() => app.close());

  it('rejects a bad workout id at Démarrer', () => http().post('/api/sessions').send({ workoutId: 'x' }).expect(400));

  it('returns the bundle: each exercise with its sets, history, known weights and step', async () => {
    const { body: bundle } = await http().get(`/api/sessions/${SESSION}/bundle`).expect(200);
    expect(bundle).toMatchObject({ id: SESSION, workoutName: 'Push' });
    const [dips, bench] = bundle.exercises;
    expect(dips).toMatchObject({ id: DIPS_ENTRY, history: [], knownWeights: [], step: 2.5, supersetGroup: null });
    expect(dips.exercise).toMatchObject({ name: 'Dips', equipment: 'bodyweight', primaryMuscles: ['chest'] });
    expect(dips.sets).toHaveLength(3);
    expect(bench).toMatchObject({ id: BENCH_ENTRY, repMin: 7, repMax: 10, step: 5, easy: false, completed: false });
    expect(bench.history).toEqual(DIPS_THEN_BENCH.bench.history);
    expect(bench.knownWeights).toEqual(DIPS_THEN_BENCH.bench.known);
    expect(bench.sets[0]).toEqual({
      index: 0,
      targetWeight: null,
      targetReps: null,
      weight: null,
      reps: null,
      done: false,
      doneAt: null,
    });
    await http().get(`/api/sessions/x/bundle`).expect(400);
  });

  it('finishes with the whole session: sets, Facile, Terminé, order and pre-fatigue from doneAt', async () => {
    await finish().expect(204);
    expect(prisma.stored!.finishedAt).toBeInstanceOf(Date);
    const [dips, bench] = prisma.stored!.exercises;
    expect(dips).toMatchObject({ easy: true, completed: true, preFatigue: 0, firstSetAt: new Date(at(0)) });
    // The 3 sets of Dips came before the first set of Développé couché.
    expect(bench).toMatchObject({ easy: false, completed: true, preFatigue: 3, firstSetAt: new Date(at(10)) });
    expect(bench.sets.map((s) => [s.targetWeight, s.targetReps, s.weight, s.reps, s.done])).toEqual([
      [60, 10, 60, 10, true],
      [60, 10, 60, 9, true],
      [null, null, null, null, false],
      [null, null, null, null, false],
    ]);
  });

  it('finishing twice (lost response) → 204 both times, stored once', async () => {
    await finish().expect(204);
    const finishedAt = prisma.stored!.finishedAt;
    await finish({ exercises: [] }).expect(204);
    expect(prisma.stored!.finishedAt).toBe(finishedAt);
    expect(prisma.stored!.exercises[1].sets[1].reps).toBe(9);
  });

  it('drops the exercises with no validated set', async () => {
    await finish({ exercises: [body.exercises[0]] }).expect(204);
    expect(prisma.stored!.exercises.map((e) => e.id)).toEqual([DIPS_ENTRY]);
  });

  it('no validated set at all: discards the session', async () => {
    await finish({ exercises: [] }).expect(204);
    expect(prisma.stored).toBeNull();
  });

  it('rejects a set index out of range, an exercise of another session, help on a barbell → 400', async () => {
    const bench = body.exercises[1];
    await finish({ exercises: [{ ...bench, sets: [done(4, 60, 10, 10)] }] }).expect(400);
    await finish({ exercises: [{ ...bench, id: S }] }).expect(400);
    await finish({ exercises: [{ ...bench, sets: [done(0, -10, 10, 10)] }] }).expect(400);
    await finish({ exercises: [{ ...bench, sets: [{ ...done(0, 60, 10, 10), doneAt: null }] }] }).expect(400);
    await finish({ exercises: [bench, bench] }).expect(400);
    expect(prisma.stored!.finishedAt).toBeNull();
  });

  it('rejects weights off the 0.5 kg grid, bad reps, bad times, unknown fields', async () => {
    const bench = body.exercises[1];
    const withSet = (set: object) => finish({ exercises: [{ ...bench, sets: [{ ...done(0, 60, 10, 10), ...set }] }] });
    await withSet({ weight: 57.3 }).expect(400);
    await withSet({ weight: 1000.5 }).expect(400);
    await withSet({ reps: 8.5 }).expect(400);
    await withSet({ doneAt: 'yesterday' }).expect(400);
    await withSet({ rpe: 8 }).expect(400);
    await finish({ exercises: [{ ...bench, feeling: 'easy' }] }).expect(400);
    await finish({}).expect(400);
    expect(prisma.stored!.finishedAt).toBeNull();
  });

  it('Quitter: discards the session', async () => {
    await http().delete(`/api/sessions/${SESSION}`).expect(204);
    expect(prisma.stored).toBeNull();
  });
});
