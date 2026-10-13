import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FoodDto } from '../../../api/generated/model'
import { AmountSheet, type Amount } from './AmountSheet'

const JAMBON: FoodDto = {
  id: 'f1',
  name: 'Jambon blanc',
  brand: null,
  per100g: { kcal: 113, protein: 21, fat: 3, carbs: 1 },
  portionGrams: 40,
}
const RIZ: FoodDto = { ...JAMBON, id: 'f2', name: 'Riz', portionGrams: null }

const text = () => (document.body.textContent ?? '').replace(/[  ]/g, ' ')

function renderSheet(food: FoodDto, initial?: Amount) {
  const onConfirm = vi.fn()
  render(<AmountSheet food={food} initial={initial} onClose={() => {}} onConfirm={onConfirm} />)
  return { user: userEvent.setup(), onConfirm, input: screen.getByLabelText(`Quantité de ${food.name}`) }
}

describe('AmountSheet (quantity of an ingredient)', () => {
  it('opens at 1 portion for a food with a portion; 2 portions are 80 g', async () => {
    const { user, onConfirm, input } = renderSheet(JAMBON)
    expect(screen.getByRole('radio', { name: 'En portions' })).toBeChecked()
    expect(input).toHaveValue('1')
    expect(text()).toContain('QuantitéportionEn portions')
    expect(text()).toContain('45 kcal')

    await user.clear(input)
    await user.type(input, '2')
    expect(text()).toContain('QuantitéportionsEn portions')
    expect(text()).toContain('90 kcalP 17 · L 2 · G 1')
    await user.click(screen.getByRole('button', { name: 'Valider' }))
    expect(onConfirm).toHaveBeenCalledWith({ grams: 80, portions: 2 })
  })

  it('converts the value typed when switching between portions and grams', async () => {
    const { user, onConfirm, input } = renderSheet(JAMBON)
    await user.clear(input)
    await user.type(input, '2')
    await user.click(screen.getByRole('radio', { name: 'En grammes' }))
    expect(input).toHaveValue('80')
    expect(text()).toContain('90 kcal')

    await user.clear(input)
    await user.type(input, '100')
    await user.click(screen.getByRole('radio', { name: 'En portions' }))
    expect(input).toHaveValue('2,5')
    await user.click(screen.getByRole('radio', { name: 'En grammes' }))
    await user.click(screen.getByRole('button', { name: 'Valider' }))
    expect(onConfirm).toHaveBeenCalledWith({ grams: 100, portions: null })
  })

  it('has grams only for a food without a portion', async () => {
    const { user, onConfirm, input } = renderSheet(RIZ)
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(input).toHaveValue('100')
    await user.click(screen.getByRole('button', { name: 'Valider' }))
    expect(onConfirm).toHaveBeenCalledWith({ grams: 100, portions: null })
  })

  it('reopens an ingredient the way it was entered', () => {
    const inPortions = renderSheet(JAMBON, { grams: 80, portions: 2 })
    expect(inPortions.input).toHaveValue('2')
    expect(screen.getByRole('radio', { name: 'En portions' })).toBeChecked()
  })

  it('reopens in grams an ingredient entered in grams', () => {
    const { input } = renderSheet(JAMBON, { grams: 80, portions: null })
    expect(input).toHaveValue('80')
    expect(screen.getByRole('radio', { name: 'En grammes' })).toBeChecked()
  })
})
