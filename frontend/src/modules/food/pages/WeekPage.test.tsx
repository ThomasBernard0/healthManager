import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { summaryWeek } from '../../../api/generated/endpoints/summary/summary'
import type { WeekSummaryDto } from '../../../api/generated/model'
import WeekPage from './WeekPage'

vi.mock('../../../api/generated/endpoints/summary/summary', () => ({ summaryWeek: vi.fn() }))

const n = (kcal: number, protein = 0, carbs = 0, fat = 0) => ({ kcal, protein, carbs, fat })
const DATES = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']
const EATEN = [2050, 1980, 2380, 1820, 1940, 2490, 1460]

function week(targets: number[] = Array(7).fill(2200), earliestDate = '2026-01-15'): WeekSummaryDto {
  const days = DATES.map((date, i) => ({
    date,
    eaten: n(EATEN[i]),
    target: n(targets[i]),
    left: n(targets[i] - EATEN[i]),
  }))
  const target = targets.reduce((a, b) => a + b, 0)
  return {
    monday: '2026-09-28',
    today: '2026-10-04',
    earliestDate,
    days,
    eaten: n(14120, 917, 1500, 463),
    target: n(target),
    left: n(target - 14120),
    elapsedDays: 7,
    average: n(2017, 131, 214.3, 66.1),
  }
}

const text = () => (document.body.textContent ?? '').replace(/[  ]/g, ' ')

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

function renderWeek(path = '/semaine/2026-09-28') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/semaine/:monday" element={<WeekPage />} />
        <Route path="/semaine" element={<WeekPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('WeekPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('shows kcal left this week, eaten, weekly target and the averages', async () => {
    vi.mocked(summaryWeek).mockResolvedValue(week())
    renderWeek()
    await screen.findByText('Par jour')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^(Cette semaine|Semaine dernière|Semaine du .*)$/)
    expect(text()).toContain('Lun 28 sept – Dim 4 oct')
    expect(text()).toMatch(/1 280kcal restantes(cette semaine)?Mangé/)
    expect(text()).toContain('Mangé14 120')
    expect(text()).toContain('Objectif semaine 15 400')
    expect(text()).toContain('Moyenne / jour2 017 kcal')
    expect(text()).toContain('Protéines / jour131 g')
    expect(text()).toContain('Glucides / jour214 g')
    expect(text()).toContain('Lipides / jour66 g')
  })

  it('says "dépassé de N" for each day over its target, not colour alone', async () => {
    vi.mocked(summaryWeek).mockResolvedValue(week())
    renderWeek()
    await screen.findByText('Par jour')
    expect(text()).toContain('Mer 30 sept · dépassé de 180')
    expect(text()).toContain('Sam 3 oct · dépassé de 290')
    expect(text()).not.toContain('Lun 28 sept · dépassé')
  })

  it('draws each day’s own target (goal changed on Wednesday)', async () => {
    vi.mocked(summaryWeek).mockResolvedValue(week([2200, 2200, 2400, 2400, 2400, 2400, 2400]))
    const { container } = renderWeek()
    await screen.findByText('Par jour')
    const ys = [...container.querySelectorAll('line')].map((l) => Number(l.getAttribute('y1')).toFixed(1))
    expect(new Set(ys.slice(0, 2)).size).toBe(1)
    expect(new Set(ys.slice(2)).size).toBe(1)
    expect(ys[0]).not.toBe(ys[2])
    expect(text()).not.toContain('Mer 30 sept · dépassé')
  })

  it('opens a day when its bar is tapped', async () => {
    vi.mocked(summaryWeek).mockResolvedValue(week())
    const user = userEvent.setup()
    renderWeek()
    await user.click(await screen.findByRole('button', { name: /^Mer 30 sept : 2\s380 kcal$/ }))
    expect(screen.getByTestId('where')).toHaveTextContent('/jour/2026-09-30')
  })

  it('stops at the week of the first day with data; days before it can’t be opened', async () => {
    vi.mocked(summaryWeek).mockResolvedValue(week(undefined, '2026-09-30'))
    renderWeek()
    await screen.findByText('Par jour')
    expect(screen.getByRole('button', { name: 'Semaine précédente' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^Mar 29 sept/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^Mer 30 sept/ })).toBeEnabled()
  })

  it('sends an older week to the week of the first day with data', async () => {
    vi.mocked(summaryWeek).mockImplementation(async (monday) => ({ ...week(undefined, '2026-09-30'), monday }))
    renderWeek('/semaine/2026-08-03')
    await waitFor(() => expect(summaryWeek).toHaveBeenLastCalledWith('2026-09-28'))
  })

  it('normalizes any date of the week to its Monday and loads it', async () => {
    vi.mocked(summaryWeek).mockResolvedValue(week())
    renderWeek('/semaine/2026-10-01')
    await screen.findByText('Par jour')
    expect(summaryWeek).toHaveBeenCalledWith('2026-09-28')
  })
})
