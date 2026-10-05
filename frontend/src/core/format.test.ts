import {
  formatDayTitle,
  formatInt,
  formatLongDate,
  formatMacros,
  formatQuantity,
  formatWeekRange,
  formatWeekTitle,
  parseNumber,
} from './format'

// fr-FR groups thousands with a narrow no-break space.
const nbsp = (s: string) => s.replace(/[  ]/g, ' ')

describe('format', () => {
  it('formats numbers the French way, rounded', () => {
    expect(nbsp(formatInt(1460))).toBe('1 460')
    expect(nbsp(formatInt(16400.4))).toBe('16 400')
    expect(formatQuantity(1.5)).toBe('×1,5')
    expect(formatMacros({ protein: 27.6, carbs: 45, fat: 13.9 })).toBe('P 28 · G 45 · L 14')
  })

  it('formats dates in French without timezone drift', () => {
    expect(formatLongDate('2026-10-04')).toBe('Dimanche 4 octobre')
    expect(formatDayTitle('2026-10-04', '2026-10-04')).toBe('Aujourd’hui')
    expect(formatDayTitle('2026-10-03', '2026-10-04')).toBe('Hier')
    expect(formatDayTitle('2026-10-05', '2026-10-04')).toBe('Demain')
    expect(formatDayTitle('2026-09-30', '2026-10-04')).toBe('Mercredi')
  })

  it('parses numbers typed with a comma', () => {
    expect(parseNumber('12,5')).toBe(12.5)
    expect(parseNumber(' 950 ')).toBe(950)
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
  })
})

describe('week formats', () => {
  it('formats the week range like the design', () => {
    expect(formatWeekRange('2026-09-28')).toBe('Lun 28 sept – Dim 4 oct')
  })

  it('names the week relative to this one', () => {
    expect(formatWeekTitle('2026-10-05', '2026-10-05')).toBe('Cette semaine')
    expect(formatWeekTitle('2026-09-28', '2026-10-05')).toBe('Semaine dernière')
    expect(formatWeekTitle('2026-10-12', '2026-10-05')).toBe('Semaine prochaine')
    expect(formatWeekTitle('2026-09-21', '2026-10-05')).toBe('Semaine du 21 septembre')
  })
})