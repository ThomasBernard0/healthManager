import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/app.setup.js';
import { FoodsController } from './../src/foods/foods.controller.js';
import { FoodsService } from './../src/foods/foods.service.js';
import { OpenFoodFactsClient } from './../src/foods/open-food-facts.client.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

type Row = Record<string, unknown> & { id: string; searchName: string };

const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const food = (n: number, name: string, kcal: number): Row => ({
  id: uuid(n),
  name,
  searchName: name.toLowerCase(),
  brand: null,
  barcode: null,
  kcal,
  protein: 1,
  carbs: 2,
  fat: 3,
  portionGrams: null,
});

/** In-memory stand-in for Food, and the meal items pointing at it. */
function fakePrisma() {
  let rows = [food(1, 'Thon', 110), food(2, 'Granola', 450), food(3, 'Pâtes', 158)];
  // Thon is in two meals.
  const items = [
    { foodId: uuid(1), meal: { name: 'Salade de thon' } },
    { foodId: uuid(1), meal: { name: 'Pâtes au thon' } },
  ];
  return {
    food: {
      findMany: () => Promise.resolve([...rows].sort((a, b) => a.searchName.localeCompare(b.searchName))),
      findUnique: ({ where }: { where: { id: string } }) => Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
      update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve(Object.assign(rows.find((r) => r.id === where.id)!, data)),
      delete: ({ where }: { where: { id: string } }) => {
        rows = rows.filter((r) => r.id !== where.id);
        return Promise.resolve();
      },
    },
    mealItem: {
      findFirst: ({ where }: { where: { foodId: string } }) =>
        Promise.resolve(
          items.filter((i) => i.foodId === where.foodId).sort((a, b) => a.meal.name.localeCompare(b.meal.name))[0] ?? null,
        ),
    },
  };
}

describe('Foods (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FoodsController],
      providers: [
        FoodsService,
        { provide: PrismaService, useValue: fakePrisma() },
        { provide: OpenFoodFactsClient, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
    configureApp(app);
    await app.init();
  });
  afterAll(() => app.close());

  it('lists every food by name', async () => {
    const res = await request(app.getHttpServer()).get('/api/foods/all').expect(200);
    expect(res.body.map((f: { name: string }) => f.name)).toEqual(['Granola', 'Pâtes', 'Thon']);
  });

  it('edits a food: name, values per 100 g and portion', async () => {
    const body = {
      name: ' Granola maison ',
      per100g: { kcal: 460, protein: 10, carbs: 60.04, fat: 18 },
      portionGrams: 45,
    };
    const res = await request(app.getHttpServer()).put(`/api/foods/${uuid(2)}`).send(body).expect(200);
    expect(res.body).toEqual({
      id: uuid(2),
      name: 'Granola maison',
      brand: null,
      per100g: { kcal: 460, protein: 10, carbs: 60, fat: 18 },
      portionGrams: 45,
    });
    await request(app.getHttpServer()).put(`/api/foods/${uuid(9)}`).send(body).expect(404);
    await request(app.getHttpServer()).put(`/api/foods/${uuid(2)}`).send({ ...body, barcode: '3017620422003' }).expect(400);
  });

  it('clears the portion when it is left out, and refuses an impossible one', async () => {
    const body = { name: 'Granola maison', per100g: { kcal: 460, protein: 10, carbs: 60, fat: 18 } };
    const res = await request(app.getHttpServer()).put(`/api/foods/${uuid(2)}`).send(body).expect(200);
    expect(res.body.portionGrams).toBeNull();
    for (const portionGrams of [0, 2000.1, 40.25]) {
      await request(app.getHttpServer()).put(`/api/foods/${uuid(2)}`).send({ ...body, portionGrams }).expect(400);
    }
    await request(app.getHttpServer()).put(`/api/foods/${uuid(2)}`).send({ ...body, units: [] }).expect(400);
  });

  it('refuses to delete a food used by a meal, naming one meal', async () => {
    const res = await request(app.getHttpServer()).delete(`/api/foods/${uuid(1)}`).expect(409);
    expect(res.body).toEqual({ statusCode: 409, message: 'A meal uses this food', mealName: 'Pâtes au thon' });
  });

  it('deletes an unused food', async () => {
    await request(app.getHttpServer()).delete(`/api/foods/${uuid(3)}`).expect(204);
    await request(app.getHttpServer()).get(`/api/foods/${uuid(3)}`).expect(404);
    await request(app.getHttpServer()).delete(`/api/foods/${uuid(3)}`).expect(404);
  });
});
