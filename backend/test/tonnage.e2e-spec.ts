import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { TonnageController } from './../src/tonnage/tonnage.controller.js';
import { TonnageService } from './../src/tonnage/tonnage.service.js';

// Routing and validation; the sums are covered by the unit tests.
describe('Tonnage (e2e)', () => {
  let app: INestApplication<App>;
  let where: { sessionExercise?: { exerciseId?: string } } = {};
  const http = () => request(app.getHttpServer());

  beforeEach(async () => {
    const prisma = {
      sessionSet: {
        findMany: (args: { where: typeof where }) => {
          where = args.where;
          return Promise.resolve([]);
        },
      },
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [TonnageController],
      providers: [TonnageService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
    configureApp(app);
    await app.init();
  });
  afterEach(() => app.close());

  it('returns the all-time total and this week', async () => {
    const res = await http().get('/api/tonnage').expect(200);
    expect(res.body).toEqual({ totalKg: 0, weekKg: 0 });
    expect(where.sessionExercise?.exerciseId).toBeUndefined();
  });

  it('one exercise; a bad id is rejected', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    await http().get(`/api/tonnage?exerciseId=${id}`).expect(200);
    expect(where.sessionExercise?.exerciseId).toBe(id);
    await http().get('/api/tonnage?exerciseId=x').expect(400);
  });
});
