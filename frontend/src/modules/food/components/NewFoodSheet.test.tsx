import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { foodsCreate, foodsUpdate } from '../../../api/generated/endpoints/foods/foods'
import type { FoodDto } from '../../../api/generated/model'
import { NewFoodSheet } from './NewFoodSheet'

vi.mock('../../../api/generated/endpoints/foods/foods', () => ({
  foodsCreate: vi.fn(),
  foodsUpdate: vi.fn(),
}))

const JAMBON: FoodDto = {
  id: 'f1',
  name: 'Jambon blanc',
  brand: null,
  per100g: { kcal: 113, protein: 21, fat: 3, carbs: 1 },
  portionGrams: 40,
}

const text = () => (document.body.textContent ?? '').replace(/[  ]/g, ' ')
const field = (name: string) => screen.getByRole('textbox', { name })

async function typeValues(user: ReturnType<typeof userEvent.setup>, kcal: string, protein: string, fat: string, carbs: string) {
  await user.type(field('Calories'), kcal)
  await user.type(field('Protéines en grammes'), protein)
  await user.type(field('Lipides en grammes'), fat)
  await user.type(field('Glucides en grammes'), carbs)
}

function renderSheet(food?: FoodDto) {
  const onSaved = vi.fn()
  render(<NewFoodSheet name="Jambon blanc" food={food} onClose={() => {}} onSaved={onSaved} />)
  return { user: userEvent.setup(), onSaved }
}

describe('NewFoodSheet (Mon aliment)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(foodsCreate).mockResolvedValue(JAMBON)
    vi.mocked(foodsUpdate).mockResolvedValue(JAMBON)
  })

  it('creates a food per 100 g by default: no portion, carbs last', async () => {
    const { user, onSaved } = renderSheet()
    expect(screen.getByRole('radio', { name: 'Pour 100 g' })).toBeChecked()
    expect(screen.queryByRole('textbox', { name: 'Poids d’une portion en grammes' })).toBeNull()
    expect(screen.getAllByRole('textbox').map((input) => input.getAttribute('aria-label'))).toEqual([
      null,
      'Calories',
      'Protéines en grammes',
      'Lipides en grammes',
      'Glucides en grammes',
    ])

    await typeValues(user, '113', '21', '3', '1')
    await user.click(screen.getByRole('button', { name: 'Créer' }))
    expect(foodsCreate).toHaveBeenCalledWith({
      name: 'Jambon blanc',
      per100g: { kcal: 113, protein: 21, fat: 3, carbs: 1 },
      portionGrams: null,
    })
    expect(onSaved).toHaveBeenCalledWith(JAMBON)
  })

  it('creates a food per portion: the weight is required, the values are stored per 100 g', async () => {
    const { user } = renderSheet()
    await typeValues(user, '45', '8,4', '1,2', '0,4')
    await user.click(screen.getByRole('radio', { name: 'Par portion' }))
    // Switching keeps the numbers typed.
    expect(field('Calories')).toHaveValue('45')
    expect(field('Protéines en grammes')).toHaveValue('8,4')
    expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled()
    expect(text()).toContain('Pour 100 g—')

    await user.type(field('Poids d’une portion en grammes'), '40')
    expect(text()).toContain('Pour 100 g113 kcal · P 21 · L 3 · G 1')
    await user.click(screen.getByRole('button', { name: 'Créer' }))
    expect(foodsCreate).toHaveBeenCalledWith({
      name: 'Jambon blanc',
      per100g: { kcal: 113, protein: 21, fat: 3, carbs: 1 },
      portionGrams: 40,
    })
  })

  it('refuses per-portion values that are impossible per 100 g', async () => {
    const { user } = renderSheet()
    await user.click(screen.getByRole('radio', { name: 'Par portion' }))
    await typeValues(user, '45', '8,4', '1,2', '0,4')
    // 45 kcal in 4 g = 1 125 kcal / 100 g
    await user.type(field('Poids d’une portion en grammes'), '4')
    expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled()
  })

  it('edits a food with a portion in Par portion, with the values of one portion', async () => {
    const { user } = renderSheet(JAMBON)
    expect(screen.getByRole('radio', { name: 'Par portion' })).toBeChecked()
    expect(field('Poids d’une portion en grammes')).toHaveValue('40')
    expect(field('Calories')).toHaveValue('45')
    expect(field('Protéines en grammes')).toHaveValue('8,4')
    expect(field('Lipides en grammes')).toHaveValue('1,2')
    expect(field('Glucides en grammes')).toHaveValue('0,4')

    // Two portions' worth in a bigger portion: per 100 g follows.
    await user.clear(field('Poids d’une portion en grammes'))
    await user.type(field('Poids d’une portion en grammes'), '50')
    expect(text()).toContain('Pour 100 g90 kcal · P 17 · L 2 · G 1')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(foodsUpdate).toHaveBeenCalledWith('f1', {
      name: 'Jambon blanc',
      per100g: { kcal: 90, protein: 16.8, fat: 2.4, carbs: 0.8 },
      portionGrams: 50,
    })
  })

  it('keeps the stored values per 100 g when only the name changes', async () => {
    // One portion of 45 g rounds to 203 kcal, which would give 451 kcal / 100 g back.
    const granola = { ...JAMBON, per100g: { kcal: 450, protein: 10, fat: 18, carbs: 60 }, portionGrams: 45 }
    const { user } = renderSheet(granola)
    expect(field('Calories')).toHaveValue('203')
    await user.type(field('Nom'), ' fumé')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(foodsUpdate).toHaveBeenCalledWith('f1', {
      name: 'Jambon blanc fumé',
      per100g: granola.per100g,
      portionGrams: 45,
    })
  })

  it('shows the stored values in Pour 100 g, and saving there clears the portion', async () => {
    const { user } = renderSheet(JAMBON)
    await user.click(screen.getByRole('radio', { name: 'Pour 100 g' }))
    expect(screen.queryByRole('textbox', { name: 'Poids d’une portion en grammes' })).toBeNull()
    expect(field('Calories')).toHaveValue('113')
    expect(field('Protéines en grammes')).toHaveValue('21')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(foodsUpdate).toHaveBeenCalledWith('f1', {
      name: 'Jambon blanc',
      per100g: { kcal: 113, protein: 21, fat: 3, carbs: 1 },
      portionGrams: null,
    })
  })
})
