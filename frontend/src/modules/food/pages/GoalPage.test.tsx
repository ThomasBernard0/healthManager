import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { goalsCurrent, goalsUpdate } from '../../../api/generated/endpoints/goals/goals'
import type { GoalDto } from '../../../api/generated/model'
import GoalPage from './GoalPage'

vi.mock('../../../api/generated/endpoints/goals/goals', () => ({
  goalsCurrent: vi.fn(),
  goalsUpdate: vi.fn(),
}))

const goal = (dailyKcal: number, protein: number, carbs: number, fat: number): GoalDto => ({
  id: 'g',
  validFrom: '2026-10-01',
  dailyKcal,
  protein,
  carbs,
  fat,
})

async function openGoal(current: GoalDto | null) {
  vi.mocked(goalsCurrent).mockResolvedValue({ today: '2026-10-12', goal: current })
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <GoalPage />
    </MemoryRouter>,
  )
  await screen.findByLabelText('Protéines par jour')
  return user
}

const carbs = () => screen.getByLabelText('Glucides par jour, calculés')
const save = () => screen.getByRole('button', { name: 'Enregistrer' })

async function type(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
  const input = screen.getByLabelText(label)
  await user.clear(input)
  await user.type(input, value)
}

describe('Mon objectif', () => {
  beforeEach(() => vi.resetAllMocks())

  it('2 400 kcal, P 160, F 80 → carbs 260, read-only, after protein and fat', async () => {
    await openGoal(goal(2400, 160, 260, 80))
    expect(carbs()).toHaveTextContent('260')
    expect(screen.queryByRole('textbox', { name: /Glucides/ })).toBeNull()
    expect(screen.getAllByRole('textbox').map((i) => i.getAttribute('aria-label'))).toEqual([
      'Protéines par jour',
      'Lipides par jour',
    ])
    expect(save()).toBeEnabled()
  })

  it('shows the derived carbs even when the stored ones differ: 2 800 kcal, P 150, F 70 → 393', async () => {
    await openGoal(goal(2800, 150, 230, 70))
    expect(carbs()).toHaveTextContent('393')
  })

  it('updates the carbs live: kcal +50 → +13 then +12, P +10 → −10, F +10 → −22', async () => {
    const user = await openGoal(goal(2400, 160, 260, 80))
    await user.click(screen.getByRole('button', { name: 'Augmenter de 50 kcal' }))
    expect(carbs()).toHaveTextContent('273')
    await user.click(screen.getByRole('button', { name: 'Augmenter de 50 kcal' }))
    expect(carbs()).toHaveTextContent('285')
    await type(user, 'Protéines par jour', '170')
    expect(carbs()).toHaveTextContent('275')
    await type(user, 'Lipides par jour', '90')
    expect(carbs()).toHaveTextContent('253')
  })

  it('saves kcal, protein and fat only', async () => {
    vi.mocked(goalsUpdate).mockResolvedValue(goal(2400, 170, 250, 80))
    const user = await openGoal(goal(2400, 160, 260, 80))
    await type(user, 'Protéines par jour', '170')
    await user.click(save())
    await waitFor(() => expect(goalsUpdate).toHaveBeenCalledWith({ dailyKcal: 2400, protein: 170, fat: 80 }))
  })

  it('1 500 kcal, P 200, F 100 → carbs in the "over" colour, save disabled', async () => {
    const user = await openGoal(goal(1500, 100, 50, 100))
    expect(save()).toBeEnabled()
    await type(user, 'Protéines par jour', '200')
    expect(carbs()).toHaveTextContent('-50')
    expect(carbs().className).toMatch(/derivedOver/)
    expect(save()).toBeDisabled()
    await user.click(save())
    expect(goalsUpdate).not.toHaveBeenCalled()
  })

  it('draws the kcal split, hidden from assistive tech: 4P / 9F / 4C over kcal, carbs last', async () => {
    await openGoal(goal(2400, 160, 260, 80))
    const bar = document.body.querySelector('[aria-hidden="true"][class*="bar"]') as HTMLElement
    const widths = Array.from(bar.children).map((c) => parseFloat((c as HTMLElement).style.width).toFixed(1))
    expect(widths).toEqual(['26.7', '30.0', '43.3'])
  })

  it('starts from 2 200 kcal, P 150, F 70 → 243 before any goal exists', async () => {
    await openGoal(null)
    expect(carbs()).toHaveTextContent('243')
  })
})
