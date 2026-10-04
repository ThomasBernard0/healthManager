import { parisToday } from '@healthmanager/shared'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { logEntriesCreateQuick } from '../../../api/generated/endpoints/log-entries/log-entries'
import { summaryDay } from '../../../api/generated/endpoints/summary/summary'
import type { DaySummaryDto, LogEntryDto } from '../../../api/generated/model'
import { ToastProvider } from '../../../core/ui/Toast'
import DayPage from './DayPage'

vi.mock('../../../api/generated/endpoints/summary/summary', () => ({ summaryDay: vi.fn() }))
vi.mock('../../../api/generated/endpoints/log-entries/log-entries', () => ({
  logEntriesCreateQuick: vi.fn(),
  logEntriesUpdate: vi.fn(),
  logEntriesDuplicate: vi.fn(),
  logEntriesRemove: vi.fn(),
  logEntriesRestore: vi.fn(),
}))

const DATE = '2026-10-04'
const n = (kcal: number, protein: number, carbs: number, fat: number) => ({ kcal, protein, carbs, fat })

const entry = (id: string, time: string, label: string, kcal: number): LogEntryDto => ({
  id,
  date: DATE,
  time,
  kind: 'quick',
  mealId: null,
  label,
  quantity: 1,
  snapshot: n(kcal, 10, 20, 5),
  total: n(kcal, 10, 20, 5),
})

function summary(overrides: Partial<DaySummaryDto> = {}): DaySummaryDto {
  return {
    date: DATE,
    today: DATE,
    goal: { id: 'g', validFrom: '2026-01-01', dailyKcal: 2200, protein: 150, carbs: 230, fat: 70 },
    eaten: n(1460, 88, 180, 41),
    left: n(740, 62, 50, 29),
    entries: [entry('a', '08:10', 'Bol yaourt grec', 420), entry('b', '12:45', 'Bowl poulet riz', 640)],
    week: { monday: '2026-09-28', eaten: n(14120, 0, 0, 0), target: n(15400, 0, 0, 0), left: n(1280, 0, 0, 0) },
    ...overrides,
  }
}

const text = (el: HTMLElement) => (el.textContent ?? '').replace(/[  ]/g, ' ')

function renderDay(path = `/jour/${DATE}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/jour/:date" element={<DayPage />} />
          <Route path="/jour" element={<DayPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('DayPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('shows kcal left, eaten, the daily goal, the week and the meals ordered by time', async () => {
    vi.mocked(summaryDay).mockResolvedValue(summary())
    renderDay()

    const meals = await screen.findByRole('heading', { name: 'Repas du jour' })
    const card = meals.closest('section')!
    expect(text(card)).toContain('2 repas · 1 460 kcal')
    const rows = within(card).getAllByRole('button')
    expect(rows.map(text)).toEqual(['08:10Bol yaourt grecP 10 · G 20 · L 5420', '12:45Bowl poulet rizP 10 · G 20 · L 5640'])

    expect(text(document.body)).toContain('740kcal restantesaujourd’hui')
    expect(text(screen.getByRole('link', { name: 'Modifier l’objectif du jour' }))).toContain('2 200')
    expect(text(document.body)).toContain('14 120 / 15 400')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aujourd’hui')
  })

  it('says "dépassé de N" when over the daily target', async () => {
    vi.mocked(summaryDay).mockResolvedValue(
      summary({ eaten: n(2500, 160, 180, 41), left: n(-300, -10, 50, 29) }),
    )
    renderDay()
    expect(await screen.findByText('dépassé de')).toBeInTheDocument()
    expect(screen.getByText('300')).toBeInTheDocument()
    expect(text(document.body)).toContain('dépassé de 10 g')
  })

  it('logs a quick entry with the default name to the viewed day', async () => {
    vi.mocked(summaryDay).mockResolvedValue(summary())
    vi.mocked(logEntriesCreateQuick).mockResolvedValue(entry('c', '20:30', 'Repas', 950))
    const user = userEvent.setup()
    renderDay()

    await user.click(await screen.findByRole('button', { name: 'Ajouter' }))
    const dialog = screen.getByRole('dialog', { name: 'Saisie rapide' })
    await user.type(within(dialog).getByLabelText('Calories'), '950')
    await user.type(within(dialog).getByLabelText('Protéines en grammes'), '38,5')
    await user.clear(within(dialog).getByLabelText('Heure du repas'))
    await user.type(within(dialog).getByLabelText('Heure du repas'), '20:30')
    await user.click(within(dialog).getByRole('button', { name: 'Ajouter à aujourd’hui' }))

    expect(logEntriesCreateQuick).toHaveBeenCalledWith({
      date: DATE,
      time: '20:30',
      label: 'Repas',
      kcal: 950,
      protein: 38.5,
      carbs: 0,
      fat: 0,
    })
    expect(summaryDay).toHaveBeenCalledTimes(2)
  })

  it('opens today on /jour', async () => {
    vi.mocked(summaryDay).mockResolvedValue(summary({ date: parisToday(), today: parisToday() }))
    renderDay('/jour')
    await screen.findByRole('heading', { name: 'Repas du jour' })
    expect(summaryDay).toHaveBeenCalledWith(parisToday())
  })
})
