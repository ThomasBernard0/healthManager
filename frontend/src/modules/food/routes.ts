import { parisToday } from '@healthmanager/shared'

/** /jour for today, /jour/YYYY-MM-DD for any other day. */
export const dayPath = (date?: string): string =>
  !date || date === parisToday() ? '/jour' : `/jour/${date}`

export const GOAL_PATH = '/objectif'

/** Gérer: every saved meal. */
export const MEALS_PATH = '/repas'

/** Nouveau repas, logged to `date` once saved. */
export const newMealPath = (date: string): string => `/repas/nouveau?date=${date}`

export const editMealPath = (id: string): string => `/repas/${id}`
