import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/app.setup.js';
import { SessionsController } from './../src/sessions/sessions.controller.js';
import { SessionsService } from './../src/sessions/sessions.service.js';

const S = '00000000-0000-4000-8000-000000000001';
const E = '00000000-0000-4000-8000-000000000002';

// The queries run against Postgres; here: routing and validation of what the app sends.
describe('Sessions (e2e)', () => {
  let app: INestApplication<App>;
  const service = {
    current: vi.fn(() => Promise.resolve({ session: null })),
    start: vi.fn(() => Promise.resolve({})),
    saveSet: vi.fn(() => Promise.resolve({})),
    updateExercise: vi.fn(() => Promise.resolve({})),
    finish: vi.fn(() => Promise.resolve()),
  };
  const http = () => request(app.getHttpServer());
  const set = (body: object, index = '0') => http().put(`/api/sessions/${S}/exercises/${E}/sets/${index}`).send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [{ provide: SessionsService, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
    configureApp(app);
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it('returns no current session', () => http().get('/api/sessions/current').expect(200, { session: null }));

  it('starts a workout by id', async () => {
    await http().post('/api/sessions').send({ workoutId: S }).expect(201);
    expect(service.start).toHaveBeenCalledWith(S);
    await http().post('/api/sessions').send({ workoutId: 'x' }).expect(400);
  });

  it('saves a set: typed values, or empty to record the target', async () => {
    await set({ weight: 57.5, reps: 10, done: true }, '2').expect(200);
    expect(service.saveSet).toHaveBeenCalledWith(S, E, 2, { weight: 57.5, reps: 10, done: true });
    await set({ weight: null, reps: null, done: true }).expect(200);
    await set({ done: true }).expect(200);
    await set({ weight: 0, reps: 12, done: false }).expect(200);
  });

  it('rejects weights off the 0.5 kg grid, bad reps, unknown fields', async () => {
    await set({ weight: 57.3, reps: 10, done: true }).expect(400);
    await set({ weight: -2.5, reps: 10, done: true }).expect(400);
    await set({ weight: 50, reps: 8.5, done: true }).expect(400);
    await set({ weight: 50, reps: 10 }).expect(400);
    await set({ weight: 50, reps: 10, done: true, rpe: 8 }).expect(400);
    await set({ done: true }, 'x').expect(400);
    expect(service.saveSet).not.toHaveBeenCalled();
  });

  it('sets Facile (or clears it) and Terminé', async () => {
    await http().patch(`/api/sessions/${S}/exercises/${E}`).send({ easy: true }).expect(200);
    await http().patch(`/api/sessions/${S}/exercises/${E}`).send({ easy: false, completed: true }).expect(200);
    expect(service.updateExercise).toHaveBeenLastCalledWith(S, E, { easy: false, completed: true });
    await http().patch(`/api/sessions/${S}/exercises/${E}`).send({ easy: 'easy' }).expect(400);
    await http().patch(`/api/sessions/${S}/exercises/${E}`).send({ feeling: 'easy' }).expect(400);
  });

  it('finishes a session', async () => {
    await http().post(`/api/sessions/${S}/finish`).expect(204);
    expect(service.finish).toHaveBeenCalledWith(S);
  });
});
