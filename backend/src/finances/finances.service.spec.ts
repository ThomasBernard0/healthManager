import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { FinancesService } from './finances.service.js';

const ID = '00000000-0000-4000-8000-000000000001';
const row = (over: object = {}) => ({
  id: ID,
  kind: 'expense',
  name: 'Loyer',
  amountCents: 85_000,
  category: 'housing',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

describe('FinancesService', () => {
  const financeLine = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  };
  const service = new FinancesService({
    financeLine,
  } as unknown as PrismaService);

  beforeEach(() => vi.resetAllMocks());

  it('creates an expense with its category', async () => {
    financeLine.create.mockResolvedValue(row());
    const line = await service.create({
      kind: 'expense',
      name: 'Loyer',
      amountCents: 85_000,
      category: 'housing',
    });
    expect(financeLine.create.mock.calls[0][0].data).toEqual({
      kind: 'expense',
      name: 'Loyer',
      amountCents: 85_000,
      category: 'housing',
    });
    expect(line).toEqual({
      id: ID,
      kind: 'expense',
      name: 'Loyer',
      amountCents: 85_000,
      category: 'housing',
    });
  });

  it('stores no category for an income', async () => {
    financeLine.create.mockResolvedValue(
      row({ kind: 'income', category: null }),
    );
    await service.create({
      kind: 'income',
      name: 'Salaire',
      amountCents: 265_000,
    });
    expect(financeLine.create.mock.calls[0][0].data.category).toBeNull();
  });

  it('rejects an expense without a category and an income with one', async () => {
    await expect(
      service.create({ kind: 'expense', name: 'x', amountCents: 1 }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create({
        kind: 'income',
        name: 'x',
        amountCents: 1,
        category: 'savings',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(financeLine.create).not.toHaveBeenCalled();
  });

  it('overwrites the amount, nothing else kept', async () => {
    financeLine.findUnique.mockResolvedValue(row());
    financeLine.update.mockResolvedValue(row({ amountCents: 90_000 }));
    await service.update(ID, { amountCents: 90_000 });
    expect(financeLine.update.mock.calls[0][0].data).toEqual({
      kind: 'expense',
      name: undefined,
      amountCents: 90_000,
      category: 'housing',
    });
  });

  it('switching an expense to an income drops its category', async () => {
    financeLine.findUnique.mockResolvedValue(row());
    financeLine.update.mockResolvedValue(
      row({ kind: 'income', category: null }),
    );
    await service.update(ID, { kind: 'income' });
    expect(financeLine.update.mock.calls[0][0].data.category).toBeNull();
  });

  it('switching an income to an expense needs a category', async () => {
    financeLine.findUnique.mockResolvedValue(
      row({ kind: 'income', category: null }),
    );
    await expect(service.update(ID, { kind: 'expense' })).rejects.toThrow(
      BadRequestException,
    );
    expect(financeLine.update).not.toHaveBeenCalled();
  });

  it('404 for an unknown line', async () => {
    financeLine.findUnique.mockResolvedValue(null);
    await expect(service.update(ID, { amountCents: 1 })).rejects.toThrow(
      NotFoundException,
    );
    financeLine.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove(ID)).rejects.toThrow(NotFoundException);
  });
});
