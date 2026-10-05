import { parseOffProduct } from './open-food-facts.client.js';

const nutella = {
  status: 1,
  product: {
    product_name_fr: 'Nutella',
    product_name: 'Nutella',
    brands: 'Nutella, Ferrero',
    serving_quantity: 15,
    nutriments: {
      'energy-kcal_100g': 539,
      'energy-kj_100g': 2252,
      proteins_100g: 6.3,
      carbohydrates_100g: 57.5,
      fat_100g: 30.9,
    },
  },
};

describe('parseOffProduct', () => {
  it('maps name, first brand, per-100 g values and serving', () => {
    expect(parseOffProduct(nutella)).toEqual({
      name: 'Nutella',
      brand: 'Nutella',
      per100g: { kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9 },
      servingGrams: 15,
    });
  });

  it('converts kJ when kcal is missing, and accepts numbers sent as strings', () => {
    const { 'energy-kcal_100g': _kcal, ...rest } = nutella.product.nutriments;
    const product = parseOffProduct({
      status: 1,
      product: {
        product_name: 'Pâte',
        nutriments: { ...rest, fat_100g: '30.9' },
      },
    });
    expect(product?.per100g).toEqual({
      kcal: 538,
      protein: 6.3,
      carbs: 57.5,
      fat: 30.9,
    });
    expect(product?.brand).toBeNull();
    expect(product?.servingGrams).toBeNull();
  });

  it('keeps the name but drops values that are missing or impossible', () => {
    const missing = parseOffProduct({
      status: 1,
      product: { product_name: 'Biscuits', nutriments: { proteins_100g: 6 } },
    });
    expect(missing).toEqual({
      name: 'Biscuits',
      brand: null,
      per100g: null,
      servingGrams: null,
    });

    const impossible = parseOffProduct({
      status: 1,
      product: {
        ...nutella.product,
        nutriments: { ...nutella.product.nutriments, 'energy-kcal_100g': 2252 },
      },
    });
    expect(impossible?.per100g).toBeNull();
  });

  it('returns null for an unknown product', () => {
    expect(parseOffProduct({ status: 0 })).toBeNull();
  });
});
