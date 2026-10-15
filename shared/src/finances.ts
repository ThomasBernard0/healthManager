export const FINANCE_KINDS = ['income', 'expense'] as const;
export type FinanceKind = (typeof FINANCE_KINDS)[number];

/** Display order (Dépenses sections, stacked bar, legend). */
export const FINANCE_CATEGORIES = ['housing', 'subscriptions', 'savings', 'other'] as const;
export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

export const FINANCE_NAME_MAX = 60;
/** 1 000 000 € a month. */
export const FINANCE_AMOUNT_MAX_CENTS = 100_000_000;

/** What the totals need from a line of the typical month. */
export interface FinanceLineAmount {
  kind: FinanceKind;
  amountCents: number;
  category?: FinanceCategory | null;
}

export interface FinanceTotals {
  income: number;
  /** Savings included: money set aside counts as spent. */
  expenses: number;
  /** income − expenses; can be negative. */
  rest: number;
  byCategory: Record<FinanceCategory, number>;
}

/** Entrées, Dépenses, Reste and each category's total, in cents. */
export function financeTotals(lines: readonly FinanceLineAmount[]): FinanceTotals {
  const byCategory: Record<FinanceCategory, number> = { housing: 0, subscriptions: 0, savings: 0, other: 0 };
  let income = 0;
  let expenses = 0;
  for (const line of lines) {
    if (line.kind === 'income') {
      income += line.amountCents;
    } else {
      expenses += line.amountCents;
      byCategory[line.category ?? 'other'] += line.amountCents;
    }
  }
  return { income, expenses, rest: income - expenses, byCategory };
}

/** Share of the incomes, as a rounded %; 0 without income. */
export function categoryShare(categoryTotal: number, income: number): number {
  return income > 0 ? Math.round((categoryTotal / income) * 100) : 0;
}

/** How full the Reste ring is (0–1): Reste / Entrées; full when Reste is negative. */
export function restRingFraction({ income, rest }: Pick<FinanceTotals, 'income' | 'rest'>): number {
  if (rest < 0) return 1;
  return income > 0 ? Math.min(rest / income, 1) : 0;
}

/** Highest amount first (lines inside their section). */
export function sortByAmount<T extends { amountCents: number }>(lines: readonly T[]): T[] {
  return [...lines].sort((a, b) => b.amountCents - a.amountCents);
}

/**
 * A typed amount in euros ("86,40", "13.5", "1 200") → cents, or null when it is not
 * a number > 0 with at most 2 decimals (or above the maximum).
 */
export function parseEurosToCents(input: string): number | null {
  const text = input.replace(/[\s  ]/g, '').replace(',', '.');
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(text);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return cents >= 1 && cents <= FINANCE_AMOUNT_MAX_CENTS ? cents : null;
}
