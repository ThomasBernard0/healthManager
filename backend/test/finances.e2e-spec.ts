import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/app.setup.js';
import { FinanceLinesController } from './../src/finances/finances.controller.js';
import { FinancesService } from './../src/finances/finances.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

type Row = Record<string, unknown> & { id: string; amountCents: number };

/** In-memory stand-in for FinanceLine. */
function fakePrisma() {
  const rows: Row[] = [];
  return {
    rows,
    financeLine: {
      findMany: () =>
        Promise.resolve(
          [...rows].sort((a, b) => b.amountCents - a.amountCents),
        ),
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
      create: ({ data }: { data: Row }) => {
        const row = {
          ...data,
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.push(row);
        return Promise.resolve(row);
      },
      update: ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = rows.find((r) => r.id === where.id)!;
        for (const [key, value] of Object.entries(data))
          if (value !== undefined) row[key] = value;
        return Promise.resolve(row);
      },
      deleteMany: ({ where }: { where: { id: string } }) => {
        const i = rows.findIndex((r) => r.id === where.id);
        if (i >= 0) rows.splice(i, 1);
        return Promise.resolve({ count: i >= 0 ? 1 : 0 });
      },
    },
  };
}

describe('Finance lines (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: ReturnType<typeof fakePrisma>;

  beforeAll(async () => {
    prisma = fakePrisma();
    const moduleRef = await Test.createTestingModule({
      controllers: [FinanceLinesController],
      providers: [
        FinancesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({
      logger: false,
    });
    configureApp(app);
    await app.init();
  });

  afterAll(() => app.close());

  const server = () => request(app.getHttpServer());
  const post = (body: object) => server().post('/api/finance-lines').send(body);
  const patch = (id: string, body: object) =>
    server().patch(`/api/finance-lines/${id}`).send(body);

  it('creates, lists, updates and deletes a line', async () => {
    const created = await post({
      kind: 'expense',
      name: '  Loyer ',
      amountCents: 85_000,
      category: 'housing',
    }).expect(201);
    expect(created.body).toMatchObject({
      kind: 'expense',
      name: 'Loyer',
      amountCents: 85_000,
      category: 'housing',
    });
    await post({
      kind: 'income',
      name: 'Salaire',
      amountCents: 265_000,
      category: null,
    }).expect(201);

    const list = await server().get('/api/finance-lines').expect(200);
    expect(list.body.map((l: Row) => l.name)).toEqual(['Salaire', 'Loyer']);
    expect(list.body[0].category).toBeNull();

    const id = created.body.id as string;
    const updated = await patch(id, { amountCents: 90_000 }).expect(200);
    expect(updated.body).toMatchObject({
      amountCents: 90_000,
      category: 'housing',
    });

    await server().delete(`/api/finance-lines/${id}`).expect(204);
    await server().delete(`/api/finance-lines/${id}`).expect(404);
    expect(prisma.rows).toHaveLength(1);
  });

  it.each([
    [
      'an income with a category',
      { kind: 'income', name: 'Salaire', amountCents: 1, category: 'savings' },
    ],
    [
      'an expense without a category',
      { kind: 'expense', name: 'Loyer', amountCents: 1 },
    ],
    [
      'an expense with a null category',
      { kind: 'expense', name: 'Loyer', amountCents: 1, category: null },
    ],
    [
      'amount 0',
      { kind: 'expense', name: 'Loyer', amountCents: 0, category: 'housing' },
    ],
    [
      'a decimal amount',
      { kind: 'expense', name: 'Loyer', amountCents: 1.5, category: 'housing' },
    ],
    [
      'an amount above 1 000 000 €',
      {
        kind: 'expense',
        name: 'Loyer',
        amountCents: 100_000_001,
        category: 'housing',
      },
    ],
    [
      'a blank name',
      { kind: 'expense', name: '   ', amountCents: 1, category: 'housing' },
    ],
    [
      'a name over 60 characters',
      {
        kind: 'expense',
        name: 'x'.repeat(61),
        amountCents: 1,
        category: 'housing',
      },
    ],
    ['no kind', { name: 'Loyer', amountCents: 1, category: 'housing' }],
    [
      'an unknown category',
      { kind: 'expense', name: 'Loyer', amountCents: 1, category: 'food' },
    ],
    [
      'an unknown field',
      {
        kind: 'expense',
        name: 'Loyer',
        amountCents: 1,
        category: 'housing',
        note: 'x',
      },
    ],
  ])('400 for %s, nothing saved', async (_, body) => {
    const before = prisma.rows.length;
    await post(body).expect(400);
    expect(prisma.rows).toHaveLength(before);
  });

  it('accepts 60 characters once trimmed', async () => {
    await post({
      kind: 'expense',
      name: ` ${'x'.repeat(60)} `,
      amountCents: 1,
      category: 'other',
    }).expect(201);
  });

  it('PATCH keeps the line valid', async () => {
    const { body } = await post({
      kind: 'income',
      name: 'Freelance',
      amountCents: 20_000,
    }).expect(201);
    await patch(body.id, { category: 'savings' }).expect(400);
    await patch(body.id, { kind: 'expense' }).expect(400);
    await patch(body.id, { amountCents: 0 }).expect(400);
    const res = await patch(body.id, {
      kind: 'expense',
      category: 'other',
    }).expect(200);
    expect(res.body).toMatchObject({ kind: 'expense', category: 'other' });
    await patch(randomUUID(), { amountCents: 1 }).expect(404);
  });
});
