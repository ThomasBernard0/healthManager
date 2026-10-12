import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { MemoryRouter } from 'react-router-dom'
import { foodsCreate, foodsListAll, foodsRemove, foodsUpdate } from '../../../api/generated/endpoints/foods/foods'
import { mealsList } from '../../../api/generated/endpoints/meals/meals'
import type { FoodDto, MealSummaryDto } from '../../../api/generated/model'
import MealsPage from './MealsPage'

vi.mock('../../../api/generated/endpoints/foods/foods', () => ({
  foodsListAll: vi.fn(),
  foodsCreate: vi.fn(),
  foodsUpdate: vi.fn(),
  foodsRemove: vi.fn(),
}))
vi.mock('../../../api/generated/endpoints/meals/meals', () => ({
  mealsList: vi.fn(),
  mealsRemove: vi.fn(),
  mealsSetFavorite: vi.fn(),
}))

const GRANOLA: FoodDto = {
  id: 'f1',
  name: 'Granola maison',
  brand: null,
  per100g: { kcal: 450, protein: 10, carbs: 60, fat: 18 },
  units: [{ label: 'bol', grams: 45 }],
}
const SKYR: FoodDto = {
  id: 'f2',
  name: 'Skyr nature',
  brand: 'Siggi’s',
  per100g: { kcal: 63, protein: 11, carbs: 4, fat: 0.2 },
  units: [],
}
const MEAL = {
  id: 'm1',
  name: 'Bol du matin',
  isFavorite: false,
  totals: { kcal: 420, protein: 30, carbs: 50, fat: 10 },
  lastEatenOn: null,
} as MealSummaryDto

const conflict = (data: unknown) =>
  new AxiosError('Conflict', undefined, undefined, undefined, { status: 409, data } as AxiosResponse)

async function openFoods() {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <MealsPage />
    </MemoryRouter>,
  )
  expect(await screen.findByText('Bol du matin')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Ingrédients' }))
  await screen.findByText('Granola maison')
  return user
}

describe('Mes repas (Gérer) — Ingrédients', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(mealsList).mockResolvedValue([MEAL])
    vi.mocked(foodsListAll).mockResolvedValue([GRANOLA, SKYR])
  })

  it('lists every ingredient in its own tab, filtered by the search', async () => {
    const user = await openFoods()
    expect(screen.queryByText('Bol du matin')).toBeNull()
    expect(screen.getByRole('button', { name: 'Ingrédients' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/63 kcal \/ 100 g/)).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Chercher un aliment' }), 'siggi')
    expect(screen.queryByText('Granola maison')).toBeNull()
    expect(screen.getByText('Skyr nature')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Repas' }))
    expect(screen.getByText('Bol du matin')).toBeInTheDocument()
  })

  it('edits an ingredient and reloads the lists', async () => {
    vi.mocked(foodsUpdate).mockResolvedValue({ ...GRANOLA, name: 'Granola' })
    const user = await openFoods()
    await user.click(screen.getByRole('button', { name: /^Granola maison/ }))
    const dialog = screen.getByRole('dialog', { name: 'Modifier l’ingrédient' })
    const name = within(dialog).getByRole('textbox', { name: 'Nom' })
    expect(name).toHaveValue('Granola maison')
    expect(within(dialog).getByRole('textbox', { name: 'Calories' })).toHaveValue('450')
    expect(within(dialog).getByRole('textbox', { name: 'Nom de l’unité' })).toHaveValue('bol')
    await user.clear(name)
    await user.type(name, 'Granola')
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    expect(foodsUpdate).toHaveBeenCalledWith('f1', {
      name: 'Granola',
      per100g: { kcal: 450, protein: 10, carbs: 60, fat: 18 },
      units: [{ label: 'bol', grams: 45 }],
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(foodsListAll).toHaveBeenCalledTimes(2)
    expect(mealsList).toHaveBeenCalledTimes(2)
  })

  it('creates an ingredient named after the search', async () => {
    vi.mocked(foodsCreate).mockResolvedValue({ ...GRANOLA, id: 'f3', name: 'Muesli' })
    const user = await openFoods()
    await user.type(screen.getByRole('searchbox', { name: 'Chercher un aliment' }), 'Muesli')
    await user.click(screen.getByRole('button', { name: 'Nouvel ingrédient' }))
    const dialog = screen.getByRole('dialog', { name: 'Mon aliment' })
    expect(within(dialog).getByRole('textbox', { name: 'Nom' })).toHaveValue('Muesli')
    await user.type(within(dialog).getByRole('textbox', { name: 'Calories' }), '380')
    await user.type(within(dialog).getByRole('textbox', { name: 'Protéines en grammes' }), '9')
    await user.type(within(dialog).getByRole('textbox', { name: 'Glucides en grammes' }), '62')
    await user.type(within(dialog).getByRole('textbox', { name: 'Lipides en grammes' }), '8')
    await user.click(within(dialog).getByRole('button', { name: 'Créer' }))
    expect(foodsCreate).toHaveBeenCalledWith({
      name: 'Muesli',
      per100g: { kcal: 380, protein: 9, carbs: 62, fat: 8 },
      units: [],
    })
  })

  it('names the meal that blocks a delete, and deletes an unused ingredient', async () => {
    vi.mocked(foodsRemove).mockRejectedValueOnce(conflict({ statusCode: 409, message: 'x', mealName: 'Bol du matin' }))
    const user = await openFoods()
    await user.click(screen.getByRole('button', { name: 'Supprimer Granola maison' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Utilisé dans le repas « Bol du matin »')
    expect(foodsRemove).toHaveBeenCalledWith('f1')
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    vi.mocked(foodsRemove).mockResolvedValueOnce(undefined)
    await user.click(screen.getByRole('button', { name: 'Supprimer Skyr nature' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(foodsRemove).toHaveBeenLastCalledWith('f2')
    expect(foodsListAll).toHaveBeenCalledTimes(2)
  })
})
