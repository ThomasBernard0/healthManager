import {
  categoryShare,
  financeTotals,
  parseEurosToCents,
  restRingFraction,
  sortByAmount,
  type FinanceLineAmount,
} from './finances.js';

const income = (amountCents: number): FinanceLineAmount => ({ kind: 'income', amountCents });
const expense = (amountCents: number, category: FinanceLineAmount['category']): FinanceLineAmount => ({
  kind: 'expense',
  amountCents,
  category,
});

/** The mockup's typical month (docs/specs/finances.md). */
const MOCKUP: FinanceLineAmount[] = [
  income(265_000),
  income(20_000),
  ...[85_000, 6_000, 4_500, 3_000, 1_200].map((c) => expense(c, 'housing')),
  ...[8_640, 3_500, 3_000, 1_500, 1_300, 1_100].map((c) => expense(c, 'subscriptions')),
  expense(20_000, 'savings'),
];

describe('financeTotals', () => {
  it('Entrées 2 850 €, Dépenses 1 387,40 € (savings included), Reste 1 462,60 €', () => {
    expect(financeTotals(MOCKUP)).toEqual({
      income: 285_000,
      expenses: 138_740,
      rest: 146_260,
      byCategory: { housing: 99_700, subscriptions: 19_040, savings: 20_000, other: 0 },
    });
  });

  it('no line → everything at 0', () => {
    expect(financeTotals([])).toEqual({
      income: 0,
      expenses: 0,
      rest: 0,
      byCategory: { housing: 0, subscriptions: 0, savings: 0, other: 0 },
    });
  });

  it('expenses above incomes → negative Reste', () => {
    expect(financeTotals([income(100_000), expense(120_000, 'housing')]).rest).toBe(-20_000);
  });
});

describe('categoryShare', () => {
  it('rounds the share of the incomes (desktop legend)', () => {
    const { income: total, byCategory, rest } = financeTotals(MOCKUP);
    expect(categoryShare(byCategory.housing, total)).toBe(35);
    expect(categoryShare(byCategory.subscriptions, total)).toBe(7);
    expect(categoryShare(byCategory.savings, total)).toBe(7);
    expect(categoryShare(rest, total)).toBe(51);
  });

  it('0 without income', () => {
    expect(categoryShare(5_000, 0)).toBe(0);
  });
});

describe('restRingFraction', () => {
  it('the ring is about 51 % full with the mockup lines', () => {
    expect(restRingFraction(financeTotals(MOCKUP))).toBeCloseTo(0.513, 3);
  });

  it('full when Reste is negative, empty without income', () => {
    expect(restRingFraction({ income: 100, rest: -1 })).toBe(1);
    expect(restRingFraction({ income: 0, rest: 0 })).toBe(0);
  });
});

describe('sortByAmount', () => {
  it('highest first, without touching the input', () => {
    const lines = [{ amountCents: 1 }, { amountCents: 3 }, { amountCents: 2 }];
    expect(sortByAmount(lines).map((l) => l.amountCents)).toEqual([3, 2, 1]);
    expect(lines[0].amountCents).toBe(1);
  });
});

describe('parseEurosToCents', () => {
  it.each([
    ['850', 85_000],
    ['86,40', 8_640],
    ['86.4', 8_640],
    ['13,5', 1_350],
    ['1 200', 120_000],
    ['0,01', 1],
    ['12,', 1_200],
  ])('%s → %i', (input, cents) => {
    expect(parseEurosToCents(input)).toBe(cents);
  });

  it.each(['', '0', '0,00', '-5', '1,234', 'abc', '1e3', '10000000,01'])('%s → null', (input) => {
    expect(parseEurosToCents(input)).toBeNull();
  });
});
