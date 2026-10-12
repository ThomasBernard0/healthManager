import { searchKey } from '@healthmanager/shared';
import { rankFoods } from './foods.service.js';

const f = (name: string) => ({ name, searchName: searchKey(name) });

describe('rankFoods', () => {
  it('puts names starting with the query first, then shorter names', () => {
    const ranked = rankFoods(
      [
        f('Sauce vinaigrette à l\'huile d\'olive'),
        f('Riz blanc, cuit'),
        f('Riz complet, cuit'),
        f('Galette de riz soufflé'),
      ],
      'riz',
    ).map((x) => x.name);
    expect(ranked).toEqual([
      'Riz blanc, cuit',
      'Riz complet, cuit',
      'Galette de riz soufflé',
      'Sauce vinaigrette à l\'huile d\'olive',
    ]);
  });
});
