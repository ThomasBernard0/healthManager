import { parisToday } from '@healthmanager/shared'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { foodsListEaten, foodsSearch } from '../../../api/generated/endpoints/foods/foods'
import {
  logEntriesCreateQuick,
  logEntriesLogFood,
  logEntriesLogMeal,
} from '../../../api/generated/endpoints/log-entries/log-entries'
import { mealsList } from '../../../api/generated/endpoints/meals/meals'
import { summaryDay } from '../../../api/generated/endpoints/summary/summary'
import type { DaySummaryDto, FoodDto, LogEntryDto, MealSummaryDto } from '../../../api/generated/model'
import { ToastProvider } from '../../../core/ui/Toast'
import DayPage from './DayPage'

vi.mock('../../../api/generated/endpoints/summary/summary', () => ({ summaryDay: vi.fn() }))
vi.mock('../../../api/generated/endpoints/meals/meals', () => ({ mealsList: vi.fn() }))
vi.mock('../../../api/generated/endpoints/foods/foods', () => ({ foodsListEaten: vi.fn(), foodsSearch: vi.fn() }))
vi.mock('../../../api/generated/endpoints/log-entries/log-entries', () => ({
  logEntriesCreateQuick: vi.fn(),
  logEntriesLogFood: vi.fn(),
  logEntriesLogMeal: vi.fn(),
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
  foodId: null,
  label,
  quantity: 1,
  grams: null,
  snapshot: n(kcal, 10, 20, 5),
  total: n(kcal, 10, 20, 5),
})

function summary(overrides: Partial<DaySummaryDto> = {}): DaySummaryDto {
  return {
    date: DATE,
    today: DATE,
    earliestDate: '2026-01-15',
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
          <Route path="/objectif" element={<div>objectif</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('DayPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(foodsListEaten).mockResolvedValue([])
    vi.mocked(foodsSearch).mockResolvedValue([])
  })

  it('shows kcal left, eaten, the daily goal, the week and the meals ordered by time', async () => {
    vi.mocked(summaryDay).mockResolvedValue(summary())
    renderDay()

    const meals = await screen.findByRole('heading', { name: 'Repas du jour' })
    const card = meals.closest('section')!
    expect(text(card)).toContain('2 repas · 1 460 kcal')
    const rows = within(card).getAllByRole('button')
    expect(rows.map(text)).toEqual(['08:10Bol yaourt grecP 10 · L 5 · G 20420', '12:45Bowl poulet rizP 10 · L 5 · G 20640'])

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

    vi.mocked(mealsList).mockResolvedValue([])
    await user.click(await screen.findByRole('button', { name: 'Ajouter' }))
    await user.click(screen.getByRole('button', { name: 'Saisie rapide' }))
    const dialog = screen.getByRole('dialog', { name: 'Saisie rapide' })
    await user.type(within(dialog).getByLabelText('Calories'), '950')
    await user.type(within(dialog).getByLabelText('Protéines en grammes'), '38,5')
    // No time field: logged at the current time.
    expect(dialog.querySelector('input[type="time"]')).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Ajouter à aujourd’hui' }))

    expect(logEntriesCreateQuick).toHaveBeenCalledWith({
      date: DATE,
      time: expect.stringMatching(/^([01]\d|2[0-3]):[0-5]\d$/),
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

  const meal = (id: string, name: string, extra: Partial<MealSummaryDto> = {}): MealSummaryDto => ({
    id,
    name,
    mode: 'manual',
    isFavorite: false,
    totals: n(250, 30, 22, 5),
    totalsSource: 'manual',
    timesEaten: 3,
    lastEatenOn: '2026-10-03',
    ...extra,
  })

  it('logs a saved meal in 2 taps from Aujourd’hui (Ajouter, +) at ×1', async () => {
    vi.mocked(summaryDay).mockResolvedValue(summary())
    vi.mocked(mealsList).mockResolvedValue([meal('m1', 'Shaker protéiné', { isFavorite: true }), meal('m2', 'Fajitas poulet')])
    vi.mocked(logEntriesLogMeal).mockResolvedValue(entry('x', '10:00', 'Shaker protéiné', 250))
    const user = userEvent.setup()
    renderDay()

    await user.click(await screen.findByRole('button', { name: 'Ajouter' })) // tap 1
    await user.click(await screen.findByRole('button', { name: 'Ajouter Shaker protéiné' })) // tap 2

    expect(logEntriesLogMeal).toHaveBeenCalledWith(
      expect.objectContaining({ mealId: 'm1', date: DATE, quantity: 1 }),
    )
    expect(await screen.findByText('Shaker protéiné ajouté', {}, { timeout: 3000 })).toBeInTheDocument()
    // Closing the sheet is a navigation (search param removed): it can land just after the toast.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('searches Mes repas without accents or case, and offers to create a missing meal', async () => {
    vi.mocked(summaryDay).mockResolvedValue(summary())
    vi.mocked(mealsList).mockResolvedValue([meal('m1', 'Shaker protéiné'), meal('m2', 'Fajitas poulet')])
    const user = userEvent.setup()
    renderDay()

    await user.click(await screen.findByRole('button', { name: 'Ajouter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ajouter un repas' })
    expect(text(dialog)).toContain('Mes repas · 2')
    expect(text(dialog)).toContain('250 kcal · P 30 · L 5 · G 22 · hier')

    const search = within(dialog).getByLabelText('Chercher dans mes repas et mes aliments')
    await user.type(search, 'FAJIT')
    expect(within(dialog).getByText('Fajitas poulet')).toBeInTheDocument()
    expect(within(dialog).queryByText('Shaker protéiné')).toBeNull()

    await user.clear(search)
    await user.type(search, 'proteine')
    expect(within(dialog).getByText('Shaker protéiné')).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'Gaspacho')
    // Once the food search found nothing either.
    expect(await within(dialog).findByRole('button', { name: 'Créer « Gaspacho »' })).toBeInTheDocument()
  })

  it('logs a saved meal once with +: no portion stepper', async () => {
    vi.mocked(summaryDay).mockResolvedValue(summary())
    vi.mocked(mealsList).mockResolvedValue([meal('m2', 'Fajitas poulet')])
    const user = userEvent.setup()
    renderDay()
    await user.click(await screen.findByRole('button', { name: 'Ajouter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ajouter un repas' })
    await within(dialog).findByText('Fajitas poulet')
    expect(within(dialog).queryByRole('button', { name: /^Fajitas poulet/ })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Augmenter la quantité' })).toBeNull()
    expect(within(dialog).getByRole('button', { name: 'Ajouter Fajitas poulet' })).toBeInTheDocument()
  })

  const BANANE: FoodDto = {
    id: 'f1',
    name: 'Banane',
    brand: null,
    per100g: n(88, 1.1, 22.8, 0.3),
    portionGrams: 120,
  }
  const RIZ: FoodDto = { id: 'f2', name: 'Riz', brand: null, per100g: n(130, 2.7, 28, 0.3), portionGrams: null }
  const foodEntry = (id: string, label: string, quantity: number, grams: number | null): LogEntryDto => ({
    ...entry(id, '10:00', label, 106),
    kind: 'food',
    foodId: 'f1',
    quantity,
    grams,
  })

  it('finds every food in the search, with the Aliment tag; + logs 1 portion', async () => {
    vi.mocked(summaryDay).mockResolvedValue(summary())
    vi.mocked(mealsList).mockResolvedValue([meal('m1', 'Shaker protéiné')])
    vi.mocked(foodsSearch).mockResolvedValue([BANANE])
    vi.mocked(logEntriesLogFood).mockResolvedValue(foodEntry('x', 'Banane', 1, null))
    const user = userEvent.setup()
    renderDay()

    await user.click(await screen.findByRole('button', { name: 'Ajouter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ajouter un repas' })
    expect(within(dialog).getByPlaceholderText('Chercher un repas ou un aliment')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Chercher dans mes repas et mes aliments'), 'ban')
    await within(dialog).findByText('Aliment')
    expect(foodsSearch).toHaveBeenLastCalledWith({ q: 'ban' })
    expect(text(dialog)).toContain('BananeAliment1 portion · 106 kcal · P 1 · L 0 · G 27')

    await user.click(within(dialog).getByRole('button', { name: 'Ajouter 1 portion de Banane' }))
    expect(logEntriesLogFood).toHaveBeenCalledWith(expect.objectContaining({ foodId: 'f1', date: DATE, portions: 1 }))
    expect(await screen.findByText('Banane ajouté', {}, { timeout: 3000 })).toBeInTheDocument()
  })

  it('lists the foods already logged alone with the meals, by use; tap → quantity → 2 portions', async () => {
    vi.mocked(summaryDay).mockResolvedValue(summary())
    vi.mocked(mealsList).mockResolvedValue([meal('m1', 'Shaker protéiné', { isFavorite: true, timesEaten: 1 }), meal('m2', 'Fajitas poulet', { timesEaten: 1 })])
    vi.mocked(foodsListEaten).mockResolvedValue([
      { food: BANANE, timesEaten: 5, lastEatenOn: '2026-10-03' },
      { food: RIZ, timesEaten: 2, lastEatenOn: '2026-10-01' },
    ])
    vi.mocked(logEntriesLogFood).mockResolvedValue(foodEntry('x', 'Banane', 2, null))
    const user = userEvent.setup()
    renderDay()

    await user.click(await screen.findByRole('button', { name: 'Ajouter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ajouter un repas' })
    await within(dialog).findByText('Banane')
    expect(text(dialog)).toContain('Mes repas · 4')
    const names = within(dialog).getAllByRole('button', { name: /^Ajouter (?!un)/ }).map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual([
      'Ajouter Shaker protéiné',
      'Ajouter 1 portion de Banane',
      'Ajouter 100 g de Riz',
      'Ajouter Fajitas poulet',
    ])
    expect(text(dialog)).toContain('100 g · 130 kcal · P 3 · L 0 · G 28')

    await user.click(within(dialog).getByRole('button', { name: /^BananeAliment/ }))
    const amount = await screen.findByRole('dialog', { name: 'Banane' })
    const input = within(amount).getByLabelText('Quantité de Banane')
    await user.clear(input)
    await user.type(input, '2')
    await user.click(within(amount).getByRole('button', { name: 'Ajouter' }))
    expect(logEntriesLogFood).toHaveBeenCalledWith(expect.objectContaining({ foodId: 'f1', date: DATE, portions: 2 }))
    expect(vi.mocked(logEntriesLogFood).mock.calls[0][0]).not.toHaveProperty('grams')
  })

  it('labels food entries with their amount: "Banane", "Banane ×2", "Riz · 150 g"', async () => {
    vi.mocked(summaryDay).mockResolvedValue(
      summary({
        entries: [foodEntry('a', 'Banane', 1, null), foodEntry('b', 'Banane', 2, null), foodEntry('c', 'Riz', 1, 150)],
      }),
    )
    renderDay()
    await screen.findByRole('heading', { name: 'Repas du jour' })
    const rows = screen.getAllByRole('button', { name: /^10:00/ }).map((b) => text(b))
    expect(rows.map((r) => r.replace(/^10:00/, '').replace(/P \d.*$/, ''))).toEqual(['Banane', 'Banane ×2', 'Riz · 150 g'])
  })
  it('shows a logged meal’s totals and Supprimer only: no time, no edit (the time is in Repas du jour)', async () => {
    vi.mocked(summaryDay).mockResolvedValue(summary())
    const user = userEvent.setup()
    renderDay()
    await user.click(await screen.findByRole('button', { name: /Bol yaourt grec/ }))
    const dialog = screen.getByRole('dialog', { name: 'Bol yaourt grec' })
    expect(text(dialog)).toContain('420 kcal')
    expect(text(dialog)).not.toContain('08:10')
    expect(text(dialog)).not.toContain('Heure')
    expect(dialog.querySelector('input')).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Enregistrer' })).toBeNull()
    expect(within(dialog).queryByText(/Dupliquer|Quantité/)).toBeNull()
    expect(within(dialog).getByRole('button', { name: 'Supprimer' })).toBeInTheDocument()
  })

  it('can’t go back before the first day with data', async () => {
    vi.mocked(summaryDay).mockResolvedValue(summary({ earliestDate: DATE }))
    renderDay()
    await screen.findByRole('heading', { name: 'Repas du jour' })
    expect(screen.getByRole('button', { name: 'Jour précédent' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Jour suivant' })).toBeEnabled()
  })

  it('can go back while after the first day with data', async () => {
    vi.mocked(summaryDay).mockResolvedValue(summary())
    renderDay()
    await screen.findByRole('heading', { name: 'Repas du jour' })
    expect(screen.getByRole('button', { name: 'Jour précédent' })).toBeEnabled()
  })

  it('sends an older date to the first day with data', async () => {
    vi.mocked(summaryDay).mockImplementation(async (date) =>
      summary({ date, earliestDate: '2026-10-02', today: '2026-10-04' }),
    )
    renderDay('/jour/2026-09-01')
    await waitFor(() => expect(summaryDay).toHaveBeenLastCalledWith('2026-10-02'))
  })
  it('opens Mon objectif from the pencil', async () => {
    vi.mocked(summaryDay).mockResolvedValue(summary())
    const user = userEvent.setup()
    renderDay()
    await user.click(await screen.findByRole('link', { name: 'Modifier l’objectif du jour' }))
    expect(await screen.findByText('objectif')).toBeInTheDocument()
  })
})