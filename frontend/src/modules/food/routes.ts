import { parisToday } from '@healthmanager/shared'

/** /jour for today, /jour/YYYY-MM-DD for any other day. */
export const dayPath = (date?: string): string =>
  !date || date === parisToday() ? '/jour' : `/jour/${date}`

export const GOAL_PATH = '/objectif'
