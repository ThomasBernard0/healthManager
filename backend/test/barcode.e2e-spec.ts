import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/app.setup.js';
import { FoodsController } from './../src/foods/foods.controller.js';
import { FoodsService } from './../src/foods/foods.service.js';
import {
  OffProduct,
  OpenFoodFactsClient,
} from './../src/foods/open-food-facts.client.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const NUTELLA = '3017620422003';
const NO_VALUES = '5000112637922';
const UNKNOWN = '96385074';

const products: Record<string, OffProduct> = {
  [NUTELLA]: {
    name: 'Nutella',
    brand: 'Ferrero',
    per100g: { kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9 },
    servingGrams: 15,
  },
  [NO_VALUES]: {
    name: 'Biscuits',
    brand: null,
    per100g: null,
    servingGrams: null,
  },
};

/** In-memory stand-in for the Food table (unique barcode, like Postgres). */
function fakePrisma() {
  const rows: Record<string, unknown>[] = [];
  const byBarcode = (barcode: string) =>
    rows.find((r) => r.barcode === barcode) ?? null;
  return {
    rows,
    food: {
      findUnique: ({ where }: { where: { barcode: string } }) =>
        Promise.resolve(byBarcode(where.barcode)),
      findUniqueOrThrow: ({ where }: { where: { barcode: string } }) =>
        Promise.resolve(byBarcode(where.barcode)),
      create: ({ data }: { data: Record<string, unknown> }) => {
        if (data.barcode && byBarcode(data.barcode as string)) {
          return Promise.reject(
            Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
          );
        }
        const row = {
          id: `00000000-0000-4000-8000-00000000000${rows.length}`,
          ...data,
        };
        rows.push(row);
        return Promise.resolve(row);
      },
    },
  };
}

describe('Barcode lookup (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: ReturnType<typeof fakePrisma>;
  const offCalls: string[] = [];

  beforeAll(async () => {
    prisma = fakePrisma();
    const moduleRef = await Test.createTestingModule({
      controllers: [FoodsController],
      providers: [
        FoodsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: OpenFoodFactsClient,
          useValue: {
            product: (code: string) => {
              offCalls.push(code);
              return Promise.resolve(products[code] ?? null);
            },
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({
      logger: false,
    });
    configureApp(app);
    await app.init();
  });
  afterAll(() => app.close());

  it('imports an Open Food Facts product once, with its serving as a unit', async () => {
    const first = await request(app.getHttpServer())
      .get(`/api/foods/barcode/${NUTELLA}`)
      .expect(200);
    expect(first.body).toMatchObject({
      food: {
        name: 'Nutella',
        brand: 'Ferrero',
        source: 'off',
        per100g: { kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9 },
        units: [{ label: 'portion', grams: 15 }],
      },
      suggestedName: null,
    });

    const again = await request(app.getHttpServer())
      .get(`/api/foods/barcode/${NUTELLA}`)
      .expect(200);
    expect(again.body.food.id).toBe(first.body.food.id);
    expect(offCalls.filter((c) => c === NUTELLA)).toHaveLength(1);
    expect(prisma.rows).toHaveLength(1);
  });

  it('returns the name only when the product has no usable values', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/foods/barcode/${NO_VALUES}`)
      .expect(200);
    expect(res.body).toEqual({ food: null, suggestedName: 'Biscuits' });
    expect(prisma.rows).toHaveLength(1);
  });

  it('returns nothing for an unknown product', () =>
    request(app.getHttpServer())
      .get(`/api/foods/barcode/${UNKNOWN}`)
      .expect(200, { food: null, suggestedName: null }));

  it('rejects an invalid barcode without calling Open Food Facts', async () => {
    const before = offCalls.length;
    await request(app.getHttpServer())
      .get('/api/foods/barcode/3017620422004')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/foods/barcode/abc')
      .expect(400);
    expect(offCalls).toHaveLength(before);
  });

  it('saves a custom food with its barcode, then finds it by scan', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/foods')
      .send({
        name: 'Mes biscuits',
        barcode: NO_VALUES,
        per100g: { kcal: 450, protein: 6, carbs: 65, fat: 18 },
      })
      .expect(201);
    const res = await request(app.getHttpServer())
      .get(`/api/foods/barcode/${NO_VALUES}`)
      .expect(200);
    expect(res.body.food.id).toBe(created.body.id);

    await request(app.getHttpServer())
      .post('/api/foods')
      .send({
        name: 'Doublon',
        barcode: NO_VALUES,
        per100g: { kcal: 1, protein: 0, carbs: 0, fat: 0 },
      })
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/foods')
      .send({
        name: 'Faux code',
        barcode: '123',
        per100g: { kcal: 1, protein: 0, carbs: 0, fat: 0 },
      })
      .expect(400);
  });
});
