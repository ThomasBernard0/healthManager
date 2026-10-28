import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { WeekSummaryDto } from '../../../api/generated/model'
import { WeekTable } from './WeekTable'

const n = (kcal: number, protein = 0, fat = 0, carbs = 0) => ({ kcal, protein, fat, carbs })
const DATES = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']

const WEEK: WeekSummaryDto = {
  monday: '2026-09-28',
  today: '2026-10-04',
  earliestDate: '2026-01-15',
  days: DATES.map((date) => ({ date, eaten: n(2000, 130, 66, 214), target: n(2200), left: n(200) })),
  eaten: n(14000, 910, 462, 1498),
  target: n(15400),
  left: n(1400),
  elapsedDays: 7,
  average: n(2000, 130, 66, 214),
}

const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map((c) => (c.textContent ?? '').replace(/[  ]/g, ' '))

describe('WeekTable', () => {
  it('lists kcal, P, L, G then the gap: carbs last, in each day and in the week total', () => {
    render(
      <MemoryRouter>
        <WeekTable week={WEEK} />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Jour', 'kcal', 'P', 'L', 'G', 'Écart'])
    const rows = screen.getAllByRole('row')
    expect(cells(rows[1])).toEqual(['Lun 28', '2 000', '130', '66', '214', '−200'])
    expect(cells(rows[8]).slice(0, 5)).toEqual(['Semaine', '14 000', '910', '462', '1 498'])
  })

  it('shows a day over its target as a neutral "+N"; only the week row can say "dépassé de"', () => {
    const days = WEEK.days.map((d, i) => (i === 2 ? { ...d, eaten: n(2380), left: n(-180) } : d))
    const { container, rerender } = render(
      <MemoryRouter>
        <WeekTable week={{ ...WEEK, days }} />
      </MemoryRouter>,
    )
    const rows = () => screen.getAllByRole('row')
    expect(cells(rows()[3]).at(-1)).toBe('+180')
    expect(cells(rows()[8]).at(-1)).toBe('1 400 restantes')
    expect(container.querySelectorAll('[class*="over" i]')).toHaveLength(0)

    rerender(
      <MemoryRouter>
        <WeekTable week={{ ...WEEK, days, left: n(-300) }} />
      </MemoryRouter>,
    )
    expect(cells(rows()[8]).at(-1)).toBe('dépassé de 300')
    expect(container.querySelectorAll('[class*="over" i]')).toHaveLength(1)
  })
})
