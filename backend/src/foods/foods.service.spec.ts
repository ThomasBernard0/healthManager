import { searchKey } from '@healthmanager/shared';
import { rankFoods } from './foods.service.js';

const f = (name: string, source: 'ciqual' | 'custom' = 'ciqual') => ({ name, source, searchName: searchKey(name) });

describe('rankFoods', () => {
  it('puts my foods first, then names starting with the query, then shorter names', () => {
    const ranked = rankFoods(
      [
        f('Sauce vinaigrette à l\'huile d\'olive'),
        f('Riz blanc, cuit'),
        f('Riz complet, cuit'),
        f('Galette de riz soufflé'),
        f('Riz au lait maison', 'custom'),
      ],
      'riz',
    ).map((x) => x.name);
    expect(ranked).toEqual([
      'Riz au lait maison',
      'Riz blanc, cuit',
      'Riz complet, cuit',
      'Galette de riz soufflé',
      'Sauce vinaigrette à l\'huile d\'olive',
    ]);
  });
});
