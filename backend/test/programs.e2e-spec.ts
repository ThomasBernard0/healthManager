import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { ProgramsController } from './../src/programs/programs.controller.js';
import { ProgramsService } from './../src/programs/programs.service.js';
import { ProgressionService } from './../src/sessions/progression.service.js';
import { WorkoutsController } from './../src/workouts/workouts.controller.js';
import { WorkoutsService } from './../src/workouts/workouts.service.js';
import { BENCH, CURL, FIRST_PROGRAM, ROWING, fakePrisma, item, uuid } from './muscu-fake.js';

describe('Programs (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = fakePrisma();
  const http = () => request(app.getHttpServer());
  const names = (body: { name: string }[]) => body.map((w) => w.name);
  const nextName = async () =>
    ((await http().get('/api/workouts').expect(200)).body as { name: string; isNext: boolean }[]).find((w) => w.isNext)
      ?.name;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProgramsController, WorkoutsController],
      providers: [
        ProgramsService,
        WorkoutsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProgressionService, useValue: { targets: () => Promise.resolve(null) } },
      ],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
    configureApp(app);
    await app.init();

    for (const [name, exerciseId] of [
      ['Push A', BENCH],
      ['Pull', ROWING],
    ]) {
      ids[name] = (await http().post('/api/workouts').send({ name, items: [item(exerciseId)] }).expect(201)).body.id;
    }
    prisma.finish(ids['Push A']);
  });
  afterAll(() => app.close());

  it('starts with one active program holding the séances', async () => {
    const res = await http().get('/api/programs').expect(200);
    expect(res.body).toEqual([{ id: FIRST_PROGRAM, name: 'Mon programme', position: 1, active: true, workoutCount: 2 }]);
    expect(await nextName()).toBe('Pull');
  });

  it('creates an inactive program; its séances stay off Accueil', async () => {
    const created = await http().post('/api/programs').send({ name: ' Jambes ' }).expect(201);
    expect(created.body).toMatchObject({ name: 'Jambes', position: 2, active: false, workouts: [] });
    ids.legs = created.body.id;
    for (const [name, exerciseId] of [
      ['Jambes A', CURL],
      ['Jambes B', ROWING],
    ]) {
      ids[name] = (
        await http().post('/api/workouts').send({ name, programId: ids.legs, items: [item(exerciseId)] }).expect(201)
      ).body.id;
    }
    expect(names((await http().get('/api/workouts').expect(200)).body)).toEqual(['Push A', 'Pull']);

    const legs = await http().get(`/api/programs/${ids.legs}`).expect(200);
    expect(legs.body.workouts.map((w: { name: string; position: number; isNext: boolean }) => [w.name, w.position, w.isNext])).toEqual([
      ['Jambes A', 1, false],
      ['Jambes B', 2, false],
    ]);
    const workout = await http().get(`/api/workouts/${ids['Jambes A']}`).expect(200);
    expect(workout.body).toMatchObject({ programId: ids.legs, programActive: false });
    expect(workout.body.items[0].exercise.workouts).toEqual([
      expect.objectContaining({ name: 'Jambes A', programId: ids.legs, programActive: false }),
    ]);
  });

  it('activating a program makes it the only active one and starts at its first séance', async () => {
    const res = await http().post(`/api/programs/${ids.legs}/activate`).expect(200);
    expect(res.body).toMatchObject({ active: true });
    const list = await http().get('/api/programs').expect(200);
    expect(list.body.map((p: { name: string; active: boolean }) => [p.name, p.active])).toEqual([
      ['Jambes', true],
      ['Mon programme', false],
    ]);
    expect(names((await http().get('/api/workouts').expect(200)).body)).toEqual(['Jambes A', 'Jambes B']);
    expect(await nextName()).toBe('Jambes A');
    prisma.finish(ids['Jambes A']);
    expect(await nextName()).toBe('Jambes B');
  });

  it('activating it again restarts at its first séance', async () => {
    await http().post(`/api/programs/${FIRST_PROGRAM}/activate`).expect(200);
    // Push A was the last one done there: without the restart, Pull would come next.
    expect(await nextName()).toBe('Push A');
  });

  it('renames a program', async () => {
    const res = await http().put(`/api/programs/${ids.legs}`).send({ name: 'Bas du corps' }).expect(200);
    expect(res.body.name).toBe('Bas du corps');
    await http().put(`/api/programs/${ids.legs}`).send({ name: '  ' }).expect(400);
    await http().put(`/api/programs/${uuid(999)}`).send({ name: 'X' }).expect(404);
    await http().post(`/api/programs/${uuid(999)}/activate`).expect(404);
  });

  it('deletes an inactive program with its séances, never the active one', async () => {
    await http().delete(`/api/programs/${FIRST_PROGRAM}`).expect(409);
    await http().delete(`/api/programs/${ids.legs}`).expect(204);
    await http().get(`/api/workouts/${ids['Jambes A']}`).expect(404);
    expect((await http().get('/api/programs').expect(200)).body).toEqual([
      expect.objectContaining({ id: FIRST_PROGRAM, position: 1, active: true }),
    ]);
    await http().delete(`/api/programs/${ids.legs}`).expect(404);
  });
});
