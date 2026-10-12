import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/app.setup.js';
import { GoalsController } from './../src/goals/goals.controller.js';
import { GoalsService } from './../src/goals/goals.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

type Row = Record<string, unknown> & { validFrom: Date };

/** In-memory stand-in for Goal. */
function fakePrisma() {
  const rows: Row[] = [];
  return {
    rows,
    goal: {
      findMany: () => Promise.resolve([...rows]),
      upsert: ({ where, create, update }: { where: { validFrom: Date }; create: Row; update: Row }) => {
        const existing = rows.find((r) => r.validFrom.getTime() === where.validFrom.getTime());
        if (existing) return Promise.resolve(Object.assign(existing, update));
        const row = { id: '00000000-0000-4000-8000-000000000001', ...create };
        rows.push(row);
        return Promise.resolve(row);
      },
    },
  };
}

describe('Goals (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: ReturnType<typeof fakePrisma>;

  beforeAll(async () => {
    prisma = fakePrisma();
    const moduleRef = await Test.createTestingModule({
      controllers: [GoalsController],
      providers: [GoalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
    configureApp(app);
    await app.init();
  });

  afterAll(() => app.close());

  const put = (body: object) => request(app.getHttpServer()).put('/api/goals/current').send(body);

  it('PUT /api/goals/current derives the carbs: 2 400 kcal, P 160, F 80 → 260', async () => {
    const res = await put({ dailyKcal: 2400, protein: 160, fat: 80 }).expect(200);
    expect(res.body).toMatchObject({ dailyKcal: 2400, protein: 160, carbs: 260, fat: 80 });

    const current = await request(app.getHttpServer()).get('/api/goals/current').expect(200);
    expect(current.body.goal).toMatchObject({ dailyKcal: 2400, protein: 160, carbs: 260, fat: 80 });
  });

  it('2 800 kcal, P 150, F 70 → 393', async () => {
    const res = await put({ dailyKcal: 2800, protein: 150, fat: 70 }).expect(200);
    expect(res.body.carbs).toBe(393);
  });

  it('1 500 kcal, P 200, F 100 → 400, nothing saved', async () => {
    const before = JSON.stringify(prisma.rows);
    await put({ dailyKcal: 1500, protein: 200, fat: 100 }).expect(400);
    expect(JSON.stringify(prisma.rows)).toBe(before);
  });

  it('no longer accepts carbs from the client', async () => {
    await put({ dailyKcal: 2400, protein: 160, carbs: 250, fat: 80 }).expect(400);
  });
});
