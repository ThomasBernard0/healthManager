/** Mon mois: the typical month. */
export const FINANCE_PATH = '/finances'

/** Ajouter (a dialog over Mon mois). */
export const NEW_FINANCE_LINE_PATH = '/finances/nouveau'

/** Modifier (a dialog over Mon mois). */
export const financeLinePath = (id: string): string => `/finances/${id}`
