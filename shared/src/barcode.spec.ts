import { normalizeBarcode } from './barcode.js';

describe('normalizeBarcode', () => {
  it('accepts valid EAN-13, EAN-8, UPC-A and GTIN-14 codes', () => {
    expect(normalizeBarcode('3017620422003')).toBe('3017620422003');
    expect(normalizeBarcode('96385074')).toBe('96385074');
    expect(normalizeBarcode('036000291452')).toBe('036000291452');
    expect(normalizeBarcode('00012345600012')).toBe('00012345600012');
  });

  it('ignores spaces and dashes', () => {
    expect(normalizeBarcode(' 3 017620 422003 ')).toBe('3017620422003');
    expect(normalizeBarcode('3017620-422003')).toBe('3017620422003');
  });

  it('rejects a wrong check digit, letters and other lengths', () => {
    expect(normalizeBarcode('3017620422004')).toBeNull();
    expect(normalizeBarcode('30176204220a3')).toBeNull();
    expect(normalizeBarcode('1234567')).toBeNull();
    expect(normalizeBarcode('')).toBeNull();
  });
});
