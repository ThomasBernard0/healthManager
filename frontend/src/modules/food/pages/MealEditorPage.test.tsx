import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { foodsCreate, foodsLookupBarcode, foodsSearch } from '../../../api/generated/endpoints/foods/foods'
import {
  logEntriesCreateQuick,
  logEntriesLogMeal,
} from '../../../api/generated/endpoints/log-entries/log-entries'
import { mealsCreate, mealsGet, mealsRemove } from '../../../api/generated/endpoints/meals/meals'
import type { FoodDto, MealDto } from '../../../api/generated/model'
import MealEditorPage from './MealEditorPage'

vi.mock('../../../api/generated/endpoints/foods/foods', () => ({
  foodsSearch: vi.fn(),
  foodsCreate: vi.fn(),
  foodsLookupBarcode: vi.fn(),
}))
vi.mock('../../../api/generated/endpoints/meals/meals', () => ({
  mealsCreate: vi.fn(),
  mealsGet: vi.fn(),
  mealsUpdate: vi.fn(),
  mealsRemove: vi.fn(),
}))
vi.mock('../../../api/generated/endpoints/log-entries/log-entries', () => ({
  logEntriesLogMeal: vi.fn(),
  logEntriesCreateQuick: vi.fn(),
}))

const food = (id: string, name: string, kcal: number, protein: number, carbs: number, fat: number, units: FoodDto['units'] = []): FoodDto => ({
  id,
  name,
  brand: null,
  source: 'ciqual',
  per100g: { kcal, protein, carbs, fat },
  units,
})

const pasta = food('f1', 'Pâtes cuites', 158, 5.8, 30.5, 0.9)
const oil = food('f2', 'Huile d’olive', 900, 0, 0, 100, [{ label: 'c. à s.', grams: 13 }])

const text = (el: HTMLElement) => (el.textContent ?? '').replace(/[  ]/g, ' ')

function renderEditor(path = '/repas/nouveau?date=2026-10-04') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/repas/nouveau" element={<MealEditorPage />} />
        <Route path="/repas/:id" element={<MealEditorPage />} />
        <Route path="/jour/:date" element={<div>jour</div>} />
        <Route path="/jour" element={<div>jour</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function addIngredient(user: ReturnType<typeof userEvent.setup>, query: string, pick: string, amount?: string, unit?: string) {
  await user.click(screen.getByRole('button', { name: '+ Ingrédient' }))
  await user.type(screen.getByLabelText('Chercher un aliment'), query)
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${pick}`) }))
  const dialog = screen.getByRole('dialog', { name: pick })
  if (unit) await user.click(within(dialog).getByRole('radio', { name: unit }))
  if (amount) {
    const input = within(dialog).getByLabelText(`Quantité de ${pick}`)
    await user.clear(input)
    await user.type(input, amount)
  }
  await user.click(within(dialog).getByRole('button', { name: 'Valider' }))
}

describe('MealEditorPage (Nouveau repas)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(foodsSearch).mockImplementation(async ({ q } = {}) =>
      [pasta, oil].filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase().slice(0, 4))),
    )
  })

  it('sums ingredients live (grams and units), then saves to Mes repas and logs it', async () => {
    vi.mocked(mealsCreate).mockResolvedValue({ id: 'm1' } as MealDto)
    const user = userEvent.setup()
    renderEditor()

    await user.type(screen.getByLabelText('Nom'), 'Salade de pâtes')
    await addIngredient(user, 'pâtes', 'Pâtes cuites', '220')
    await addIngredient(user, 'huile', 'Huile d’olive', '1', 'c. à s.')

    // 220 g pasta = 348 kcal; 1 c. à s. (13 g) oil = 117 kcal → 465
    expect(text(document.body)).toContain('1 c. à s.')
    expect(text(document.body)).toContain('465 kcal')

    await user.click(screen.getByRole('button', { name: 'Enregistrer et ajouter au 4 octobre' }))
    expect(mealsCreate).toHaveBeenCalledWith({
      name: 'Salade de pâtes',
      mode: 'ingredients',
      items: [
        { foodId: 'f1', grams: 220, unitLabel: null, unitCount: null },
        { foodId: 'f2', grams: 13, unitLabel: 'c. à s.', unitCount: 1 },
      ],
      manualTotals: null,
      override: null,
      isFavorite: false,
    })
    expect(logEntriesLogMeal).toHaveBeenCalledWith(expect.objectContaining({ mealId: 'm1', date: '2026-10-04', quantity: 1 }))
    expect(await screen.findByText('jour')).toBeInTheDocument()
  })

  it('can correct the total and shows that the corrected total is used', async () => {
    vi.mocked(mealsCreate).mockResolvedValue({ id: 'm1' } as MealDto)
    const user = userEvent.setup()
    renderEditor()
    await user.type(screen.getByLabelText('Nom'), 'Pâtes')
    await addIngredient(user, 'pâtes', 'Pâtes cuites', '100')
    await user.click(screen.getByRole('button', { name: 'Corriger' }))
    expect(screen.getByText('Total corrigé')).toBeInTheDocument()
    const kcal = screen.getByLabelText('Calories')
    await user.clear(kcal)
    await user.type(kcal, '200')
    await user.click(screen.getByRole('button', { name: /^Enregistrer et ajouter/ }))
    expect(vi.mocked(mealsCreate).mock.calls[0][0].override).toEqual({ kcal: 200, protein: 5.8, carbs: 30.5, fat: 0.9 })
  })

  it('creates "Mon aliment" when the food is not in the database', async () => {
    vi.mocked(foodsCreate).mockResolvedValue(food('f9', 'Granola maison', 450, 10, 60, 18))
    const user = userEvent.setup()
    renderEditor()
    await user.click(screen.getByRole('button', { name: '+ Ingrédient' }))
    await user.type(screen.getByLabelText('Chercher un aliment'), 'Granola maison')
    await user.click(await screen.findByRole('button', { name: 'Créer « Granola maison »' }))
    const dialog = screen.getByRole('dialog', { name: 'Mon aliment' })
    await user.type(within(dialog).getByLabelText('Calories'), '450')
    await user.type(within(dialog).getByLabelText('Protéines en grammes'), '10')
    await user.type(within(dialog).getByLabelText('Glucides en grammes'), '60')
    await user.type(within(dialog).getByLabelText('Lipides en grammes'), '18')
    await user.click(within(dialog).getByRole('button', { name: 'Créer' }))
    expect(foodsCreate).toHaveBeenCalledWith({
      name: 'Granola maison',
      per100g: { kcal: 450, protein: 10, carbs: 60, fat: 18 },
      units: [],
    })
    expect(await screen.findByRole('dialog', { name: 'Granola maison' })).toBeInTheDocument()
  })

  describe('Scanner', () => {
    async function scanTyped(user: ReturnType<typeof userEvent.setup>, code: string) {
      await user.click(screen.getByRole('button', { name: 'Scanner' }))
      const dialog = screen.getByRole('dialog', { name: 'Scanner' })
      await user.type(within(dialog).getByLabelText('Code-barres'), code)
      await user.click(within(dialog).getByRole('button', { name: 'Rechercher' }))
    }

    it('adds a scanned product with the grams asked', async () => {
      const nutella = { ...food('f7', 'Nutella', 539, 6.3, 57.5, 30.9), source: 'off' as const }
      vi.mocked(foodsLookupBarcode).mockResolvedValue({ food: nutella, suggestedName: null })
      const user = userEvent.setup()
      renderEditor()
      await scanTyped(user, '3017620 422003')
      expect(foodsLookupBarcode).toHaveBeenCalledWith('3017620422003')

      const dialog = await screen.findByRole('dialog', { name: 'Nutella' })
      const input = within(dialog).getByLabelText('Quantité de Nutella')
      await user.clear(input)
      await user.type(input, '15')
      await user.click(within(dialog).getByRole('button', { name: 'Valider' }))
      // 15 g × 539 kcal / 100 g = 81
      expect(text(document.body)).toContain('81 kcal')
    })

    it('creates "Mon aliment" with the barcode when the product is unknown', async () => {
      vi.mocked(foodsLookupBarcode).mockResolvedValue({ food: null, suggestedName: 'Biscuits' })
      vi.mocked(foodsCreate).mockResolvedValue(food('f8', 'Biscuits', 450, 6, 65, 18))
      const user = userEvent.setup()
      renderEditor()
      await scanTyped(user, '5000112637922')

      const dialog = await screen.findByRole('dialog', { name: 'Mon aliment' })
      expect(within(dialog).getByLabelText('Nom')).toHaveValue('Biscuits')
      expect(text(dialog)).toContain('5000112637922')
      await user.type(within(dialog).getByLabelText('Calories'), '450')
      await user.type(within(dialog).getByLabelText('Protéines en grammes'), '6')
      await user.type(within(dialog).getByLabelText('Glucides en grammes'), '65')
      await user.type(within(dialog).getByLabelText('Lipides en grammes'), '18')
      await user.click(within(dialog).getByRole('button', { name: 'Créer' }))
      expect(foodsCreate).toHaveBeenCalledWith({
        name: 'Biscuits',
        barcode: '5000112637922',
        per100g: { kcal: 450, protein: 6, carbs: 65, fat: 18 },
        units: [],
      })
      expect(await screen.findByRole('dialog', { name: 'Biscuits' })).toBeInTheDocument()
    })

    it('rejects a mistyped barcode without searching, and says when the camera is unavailable', async () => {
      const user = userEvent.setup()
      renderEditor()
      await scanTyped(user, '3017620422004')
      expect(screen.getByText('Code-barres invalide')).toBeInTheDocument()
      expect(foodsLookupBarcode).not.toHaveBeenCalled()
      // jsdom has no camera.
      expect(await screen.findByText('Caméra indisponible')).toBeInTheDocument()
    })
  })

  it('without "Enregistrer dans mes repas", logs a one-time entry with the totals', async () => {
    const user = userEvent.setup()
    renderEditor('/repas/nouveau?date=2026-10-04&nom=Brunch')
    expect(screen.getByLabelText('Nom')).toHaveValue('Brunch')
    await user.click(screen.getByRole('radio', { name: 'Saisir les totaux' }))
    await user.type(screen.getByLabelText('Calories'), '900')
    await user.type(screen.getByLabelText('Protéines en grammes'), '35')
    await user.click(screen.getByRole('checkbox', { name: 'Enregistrer dans mes repas' }))
    await user.click(screen.getByRole('button', { name: 'Ajouter au 4 octobre' }))
    expect(mealsCreate).not.toHaveBeenCalled()
    expect(logEntriesCreateQuick).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-10-04', label: 'Brunch', kcal: 900, protein: 35, carbs: 0, fat: 0 }),
    )
  })
  it('starts a new meal saved to Mes repas but not as a favourite, with no time field', () => {
    renderEditor()
    expect(screen.getByRole('checkbox', { name: 'Enregistrer dans mes repas' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Favori' })).not.toBeChecked()
    expect(document.querySelector('input[type="time"]')).toBeNull()
  })

  it('deletes a saved meal for good, after confirming', async () => {
    vi.mocked(mealsGet).mockResolvedValue({
      id: 'm1',
      name: 'Pomme',
      mode: 'manual',
      isFavorite: false,
      totals: { kcal: 80, protein: 0, carbs: 20, fat: 0 },
      totalsSource: 'manual',
      timesEaten: 2,
      lastEatenOn: '2026-10-03',
      items: [],
      manualTotals: { kcal: 80, protein: 0, carbs: 20, fat: 0 },
      override: null,
    } as MealDto)
    const user = userEvent.setup()
    renderEditor('/repas/m1')
    await user.click(await screen.findByRole('button', { name: 'Supprimer' }))
    const confirm = screen.getByRole('dialog', { name: 'Supprimer « Pomme » ?' })
    await user.click(within(confirm).getByRole('button', { name: 'Annuler' }))
    expect(mealsRemove).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
    expect(mealsRemove).toHaveBeenCalledWith('m1')
    expect(await screen.findByText('jour')).toBeInTheDocument()
  })
  it('has no Scanner on desktop (camera feature): + Ingrédient only', () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes('min-width'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia
    try {
      renderEditor()
      expect(screen.getByRole('button', { name: '+ Ingrédient' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Scanner' })).toBeNull()
    } finally {
      window.matchMedia = original
    }
  })
})
