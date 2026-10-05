import { readFileSync } from 'node:fs';
import { CIQUAL_FILE, parseCiqual } from './import-ciqual.js';

describe('CIQUAL data', () => {
  const rows = parseCiqual(readFileSync(CIQUAL_FILE, 'utf8'));

  it('parses every food with kcal and the three macros', () => {
    expect(rows.length).toBeGreaterThan(3000);
    for (const row of rows) {
      expect(row.code).toMatch(/^\d+$/);
      expect(row.name.length).toBeGreaterThan(0);
      for (const v of [row.kcal, row.protein, row.carbs, row.fat]) {
        expect(Number.isFinite(v) && v >= 0).toBe(true);
      }
    }
    expect(new Set(rows.map((r) => r.code)).size).toBe(rows.length);
  });

  it('has sensible values', () => {
    const oil = rows.find((r) => r.name === 'Huile d\'olive vierge extra');
    expect(oil).toMatchObject({ kcal: 900, fat: 99.9 });
  });

  it('rejects an unexpected file', () => {
    expect(() => parseCiqual('a\tb\n1\t2')).toThrow(/header/);
  });
});
