import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { DaySummaryDto, WeekSummaryDto } from '../../../api/generated/model'
import { DayDesktop } from './DayDesktop'

const n = (kcal: number, protein = 0, fat = 0, carbs = 0) => ({ kcal, protein, fat, carbs })
const DATES = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']
// Wed +180 and Sat +290 over their day target; the week is under.
const EATEN = [2050, 1980, 2380, 1820, 1940, 2490, 1460]

const WEEK: WeekSummaryDto = {
  monday: '2026-09-28',
  today: '2026-10-04',
  earliestDate: '2026-01-15',
  days: DATES.map((date, i) => ({ date, eaten: n(EATEN[i]), target: n(2200), left: n(2200 - EATEN[i]) })),
  eaten: n(14120),
  target: n(15400),
  left: n(1280),
  elapsedDays: 7,
  average: n(2017),
}

const DAY: DaySummaryDto = {
  date: '2026-10-04',
  today: '2026-10-04',
  earliestDate: '2026-01-15',
  goal: { id: 'g1', validFrom: '2026-01-15', dailyKcal: 2200, protein: 150, fat: 70, carbs: 230 },
  eaten: n(1460, 88, 41, 180),
  left: n(740, 62, 29, 50),
  entries: [],
  week: { monday: '2026-09-28', eaten: n(14120), target: n(15400), left: n(1280) },
}

describe('DayDesktop mini week chart', () => {
  it('draws the dashed daily target and no orange bar for a day over it', () => {
    const { container } = render(
      <MemoryRouter>
        <DayDesktop data={DAY} week={WEEK} onOpenEntry={() => {}} onAdd={() => {}} />
      </MemoryRouter>,
    )
    const lines = [...container.querySelectorAll('line')].map((l) => l.getAttribute('y1'))
    expect(lines).toHaveLength(7)
    expect(new Set(lines).size).toBe(1)
    expect(container.querySelectorAll('[class*="over" i]')).toHaveLength(0)
    expect(container.textContent).not.toContain('dépassé')
  })
})
