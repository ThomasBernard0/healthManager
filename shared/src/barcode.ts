/** GTIN lengths found on food packaging: EAN-8, UPC-A, EAN-13, GTIN-14. */
const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

/** GTIN check digit: weights 3,1,3,1… from the right, excluding the check digit itself. */
function hasValidCheckDigit(code: string): boolean {
  const digits = [...code].map(Number);
  const check = digits.pop() ?? 0;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Typed or scanned barcode → digits only, or null if it isn't a valid GTIN
 * (spaces and dashes are ignored; a wrong check digit means a typo or a misread).
 */
export function normalizeBarcode(input: string): string | null {
  const code = input.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(code) || !GTIN_LENGTHS.has(code.length)) return null;
  return hasValidCheckDigit(code) ? code : null;
}
