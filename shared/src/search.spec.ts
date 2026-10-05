import { matchesSearch, searchKey, searchTerms } from './search.js';

describe('search', () => {
  it('ignores accents, case and extra spaces', () => {
    expect(searchKey('  Pâtes  FRAÎCHES ')).toBe('pates fraiches');
    expect(searchKey('Œuf à la coque')).toBe('oeuf a la coque');
  });

  it('matches anywhere in the name, every word', () => {
    const key = searchKey('Fajitas poulet');
    expect(matchesSearch(key, 'fajit')).toBe(true);
    expect(matchesSearch(key, 'POULET')).toBe(true);
    expect(matchesSearch(key, 'poulet faj')).toBe(true);
    expect(matchesSearch(key, 'boeuf')).toBe(false);
    expect(matchesSearch(searchKey('Crème brûlée'), 'creme brulee')).toBe(true);
  });

  it('matches everything with an empty query', () => {
    expect(searchTerms('  ')).toEqual([]);
    expect(matchesSearch('anything', '')).toBe(true);
  });
});
