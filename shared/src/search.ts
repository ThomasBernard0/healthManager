/** Lowercase, accents stripped, spaces collapsed: "Pâtes  Fraîches" → "pates fraiches". */
export function searchKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The words of a query, as search keys. */
export function searchTerms(query: string): string[] {
  return searchKey(query).split(' ').filter(Boolean);
}

/** Every word of the query appears somewhere in the key ("fajit" finds "fajitas poulet"). */
export function matchesSearch(key: string, query: string): boolean {
  return searchTerms(query).every((term) => key.includes(term));
}
