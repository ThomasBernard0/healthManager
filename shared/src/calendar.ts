/**
 * Calendar maths on local dates ("YYYY-MM-DD") and times ("HH:mm") in Europe/Paris.
 * Dates are plain strings; arithmetic is done at UTC midnight so DST never shifts a day.
 */
export const TIME_ZONE = 'Europe/Paris';

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = toUtcDate(value);
  return !Number.isNaN(date.getTime()) && fromUtcDate(date) === value;
}

/** Today's date in Paris. */
export function parisToday(now: Date = new Date()): string {
  return dateFormatter.format(now);
}

/** The current time in Paris, "HH:mm". */
export function parisNowTime(now: Date = new Date()): string {
  return timeFormatter.format(now);
}

/** "YYYY-MM-DD" → Date at UTC midnight (also how Postgres `date` columns come back). */
export function toUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Date at UTC midnight → "YYYY-MM-DD". */
export function fromUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = toUtcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcDate(d);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: string): number {
  return (toUtcDate(date).getUTCDay() + 6) % 7;
}

/** The Monday that starts the week of `date` (weeks run Monday 00:00 → next Monday 00:00). */
export function weekStart(date: string): string {
  return addDays(date, -weekdayIndex(date));
}

/** The 7 dates of the week starting `monday`. */
export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
