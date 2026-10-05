import { addDays, toUtcDate } from '@healthmanager/shared'
import { fr } from '../i18n/fr'

/** All numbers: fr-FR grouping ("1 460"), rounded only here, in the UI. */
const integer = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

// Intl uses U+202F (narrow no-break space) between thousands, which Space Grotesk renders
// with no width: use a regular no-break space, as in the design ("1 460").
const groupSpace = (s: string) => s.replace(/ /g, ' ')

export const formatInt = (n: number): string => groupSpace(integer.format(Math.round(n) || 0))

export const formatDecimal = (n: number): string => groupSpace(decimal.format(n))

export const formatGrams = (n: number): string => `${formatInt(n)} ${fr.common.grams}`

/** "×1,5" */
export const formatQuantity = (n: number): string => `×${formatDecimal(n)}`

/** "P 28 · G 45 · L 14" */
export function formatMacros(n: { protein: number; carbs: number; fat: number }): string {
  return [
    `${fr.macros.p} ${formatInt(n.protein)}`,
    `${fr.macros.g} ${formatInt(n.carbs)}`,
    `${fr.macros.l} ${formatInt(n.fat)}`,
  ].join(' · ')
}

// Dates are local "YYYY-MM-DD" strings: format them at UTC midnight in UTC.
const longDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})
const dayMonth = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "Dimanche 4 octobre" */
export const formatLongDate = (date: string): string =>
  capitalize(longDate.format(toUtcDate(date)))

/** "4 octobre" */
export const formatDayMonth = (date: string): string => dayMonth.format(toUtcDate(date))

/** "Aujourd'hui" / "Hier" / "Demain" / "Mardi" — the title of a day. */
export function formatDayTitle(date: string, today: string): string {
  if (date === today) return fr.days.today
  if (date === addDays(today, -1)) return fr.days.yesterday
  if (date === addDays(today, 1)) return fr.days.tomorrow
  return capitalize(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' }).format(toUtcDate(date)))
}

const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' })
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** When a meal was last eaten: "aujourd'hui", "hier", "samedi" (this past week), else "12 sept.". */
export function formatLastEaten(date: string, today: string): string {
  if (date === today) return fr.add.today
  if (date === addDays(today, -1)) return fr.add.yesterday
  if (date >= addDays(today, -6) && date < today) return weekday.format(toUtcDate(date))
  return shortDate.format(toUtcDate(date))
}

const noDot = (s: string) => s.replace(/\.$/, '')
const shortWeekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' })
const shortMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' })

/** "Lun 28 sept" */
export function formatShortDay(date: string): string {
  const d = toUtcDate(date)
  return `${capitalize(noDot(shortWeekday.format(d)))} ${d.getUTCDate()} ${noDot(shortMonth.format(d))}`
}

/** "Lun 28 sept – Dim 4 oct" */
export const formatWeekRange = (monday: string): string =>
  `${formatShortDay(monday)} – ${formatShortDay(addDays(monday, 6))}`

/** "Cette semaine" / "Semaine dernière" / "Semaine prochaine" / "Semaine du 21 septembre". */
export function formatWeekTitle(monday: string, thisMonday: string): string {
  if (monday === thisMonday) return fr.week.thisWeek
  if (monday === addDays(thisMonday, -7)) return fr.week.lastWeek
  if (monday === addDays(thisMonday, 7)) return fr.week.nextWeek
  return fr.week.weekOf(formatDayMonth(monday))
}

/** Parses a typed number, accepting a French decimal comma. Empty → null. */
export function parseNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.')
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}
