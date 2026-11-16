/** A row of Ajout rapide → Mes repas: a saved meal, or a food logged on its own (never a favourite). */
export interface QuickAddRow {
  name: string;
  isFavorite: boolean;
  timesEaten: number;
  /** YYYY-MM-DD */
  lastEatenOn: string | null;
}

/** Mes repas order: favourites first, then most eaten, then most recently eaten, then by name. */
export function compareQuickAdd(a: QuickAddRow, b: QuickAddRow): number {
  return (
    Number(b.isFavorite) - Number(a.isFavorite) ||
    b.timesEaten - a.timesEaten ||
    (b.lastEatenOn ?? '').localeCompare(a.lastEatenOn ?? '') ||
    a.name.localeCompare(b.name, 'fr')
  );
}
