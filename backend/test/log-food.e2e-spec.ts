import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/app.setup.js';
import { FoodsController } from './../src/foods/foods.controller.js';
import { FoodsService } from './../src/foods/foods.service.js';
import { OpenFoodFactsClient } from './../src/foods/open-food-facts.client.js';
import { LogEntriesController } from './../src/log-entries/log-entries.controller.js';
import { LogEntriesService } from './../src/log-entries/log-entries.service.js';
import { MealsService } from './../src/meals/meals.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

type Row = Record<string, unknown> & { id: string };

const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const BANANA = uuid(1);
const RICE = uuid(2);
const OIL = uuid(3);

const food = (id: string, name: string, kcal: number, protein: number, carbs: number, fat: number, portionGrams: number | null) => ({
  id,
  name,
  searchName: name.toLowerCase(),
  brand: null,
  barcode: null,
  kcal,
  protein,
  carbs,
  fat,
  portionGrams,
});

/** In-memory Food and LogEntry. Huile is only used in meals (MealItem), never logged on its own. */
function fakePrisma() {
  const foods = [
    food(BANANA, 'Banane', 88, 1.1, 22.8, 0.3, 120),
    food(RICE, 'Riz', 130, 2.7, 28, 0.3, null),
    food(OIL, 'Huile', 900, 0, 0, 100, null),
  ];
  let entries: Row[] = [
    // A meal entry: Huile is in it, but it isn't a food log.
    { id: uuid(9), kind: 'meal', mealId: null, foodId: null, date: new Date('2026-11-01') },
  ];
  let next = 0;
  return {
    food: {
      findUnique: ({ where }: { where: { id: string } }) => Promise.resolve(foods.find((f) => f.id === where.id) ?? null),
      findMany: ({ where }: { where?: { id?: { in: string[] }; AND?: { searchName: { contains: string } }[] } } = {}) =>
        Promise.resolve(
          foods.filter(
            (f) =>
              (!where?.id || where.id.in.includes(f.id)) &&
              (where?.AND ?? []).every((t) => f.searchName.includes(t.searchName.contains)),
          ),
        ),
    },
    meal: { findUnique: () => Promise.resolve(null) },
    logEntry: {
      create: ({ data }: { data: Row }) => {
        const entry = { id: `10000000-0000-4000-8000-00000000000${next++}`, mealId: null, foodId: null, grams: null, ...data };
        entries.push(entry);
        return Promise.resolve(entry);
      },
      findUnique: ({ where }: { where: { id: string } }) => Promise.resolve(entries.find((e) => e.id === where.id) ?? null),
      delete: ({ where }: { where: { id: string } }) => {
        entries = entries.filter((e) => e.id !== where.id);
        return Promise.resolve();
      },
      groupBy: () => {
        const solo = entries.filter((e) => e.kind === 'food' && e.foodId !== null);
        const ids = [...new Set(solo.map((e) => e.foodId as string))];
        return Promise.resolve(
          ids.map((foodId) => {
            const mine = solo.filter((e) => e.foodId === foodId);
            const max = mine.map((e) => e.date as Date).sort((a, b) => b.getTime() - a.getTime())[0];
            return { foodId, _count: { _all: mine.length }, _max: { date: max } };
          }),
        );
      },
    },
  };
}

describe('Log a food (e2e)', () => {
  let app: INestApplication<App>;
  const at = { date: '2026-11-15', time: '10:30' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FoodsController, LogEntriesController],
      providers: [
        FoodsService,
        LogEntriesService,
        { provide: MealsService, useValue: {} },
        { provide: PrismaService, useValue: fakePrisma() },
        { provide: OpenFoodFactsClient, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
    configureApp(app);
    await app.init();
  });
  afterAll(() => app.close());

  const eaten = async () => (await request(app.getHttpServer()).get('/api/foods/eaten').expect(200)).body;

  it('lists no food before one is logged on its own (meal entries do not count)', async () => {
    expect(await eaten()).toEqual([]);
  });

  it('logs portions: one portion frozen as the snapshot, quantity the count', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/log-entries/food')
      .send({ ...at, foodId: BANANA, portions: 2 })
      .expect(201);
    expect(res.body).toMatchObject({
      kind: 'food',
      foodId: BANANA,
      mealId: null,
      label: 'Banane',
      quantity: 2,
      grams: null,
      // 120 g of 88 kcal / 100 g.
      snapshot: { kcal: 106, protein: 1.3, carbs: 27.4, fat: 0.4 },
      total: { kcal: 212, protein: 2.6, carbs: 54.8, fat: 0.8 },
    });
  });

  it('logs grams: the snapshot is those grams, quantity 1', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/log-entries/food')
      .send({ ...at, foodId: RICE, grams: 150 })
      .expect(201);
    expect(res.body).toMatchObject({
      label: 'Riz',
      quantity: 1,
      grams: 150,
      snapshot: { kcal: 195, protein: 4.1, carbs: 42, fat: 0.5 },
      total: { kcal: 195, protein: 4.1, carbs: 42, fat: 0.5 },
    });
  });

  it('refuses portions for a food without one, both or neither amount, an unknown food', async () => {
    const post = (body: object) => request(app.getHttpServer()).post('/api/log-entries/food').send({ ...at, ...body });
    await post({ foodId: RICE, portions: 1 }).expect(400);
    await post({ foodId: BANANA, portions: 1, grams: 120 }).expect(400);
    await post({ foodId: BANANA }).expect(400);
    await post({ foodId: BANANA, grams: 0 }).expect(400);
    await post({ foodId: uuid(8), grams: 100 }).expect(404);
  });

  it('lists the foods logged on their own, with how often and when; not a food used only in meals', async () => {
    await request(app.getHttpServer())
      .post('/api/log-entries/food')
      .send({ date: '2026-11-16', time: '08:00', foodId: BANANA, portions: 1 })
      .expect(201);
    const list = await eaten();
    expect(list.map((e: { food: { name: string }; timesEaten: number; lastEatenOn: string }) => [e.food.name, e.timesEaten, e.lastEatenOn])).toEqual([
      ['Banane', 2, '2026-11-16'],
      ['Riz', 1, '2026-11-15'],
    ]);
  });

  it('search finds every food, logged or not', async () => {
    const res = await request(app.getHttpServer()).get('/api/foods?q=huil').expect(200);
    expect(res.body.map((f: { name: string }) => f.name)).toEqual(['Huile']);
  });

  it('deletes a food entry and restores it with its food and grams', async () => {
    const logged = await request(app.getHttpServer())
      .post('/api/log-entries/food')
      .send({ ...at, foodId: RICE, grams: 80 })
      .expect(201);
    await request(app.getHttpServer()).delete(`/api/log-entries/${logged.body.id}`).expect(204);
    const { id: _id, total: _total, ...entry } = logged.body;
    const restored = await request(app.getHttpServer()).post('/api/log-entries/restore').send(entry).expect(201);
    expect(restored.body).toMatchObject({ kind: 'food', foodId: RICE, label: 'Riz', quantity: 1, grams: 80 });
  });
});
