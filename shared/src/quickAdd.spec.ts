import { compareQuickAdd, type QuickAddRow } from './quickAdd.js';

const row = (name: string, over: Partial<QuickAddRow> = {}): QuickAddRow => ({
  name,
  isFavorite: false,
  timesEaten: 0,
  lastEatenOn: null,
  ...over,
});

describe('compareQuickAdd', () => {
  it('sorts favourites, then most eaten, then most recent, then by name', () => {
    const rows = [
      row('Riz', { timesEaten: 2, lastEatenOn: '2026-11-10' }),
      row('Banane', { timesEaten: 2, lastEatenOn: '2026-11-15' }),
      row('Abricot'),
      row('Fajitas', { isFavorite: true }),
      row('Shaker', { timesEaten: 9, lastEatenOn: '2026-11-01' }),
    ];
    expect(rows.sort(compareQuickAdd).map((r) => r.name)).toEqual(['Fajitas', 'Shaker', 'Banane', 'Riz', 'Abricot']);
  });
});
