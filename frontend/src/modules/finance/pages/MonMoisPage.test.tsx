import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, type Location } from 'react-router-dom'
import {
  financeLinesCreate,
  financeLinesList,
  financeLinesRemove,
  financeLinesUpdate,
} from '../../../api/generated/endpoints/finances/finances'
import type { FinanceLineDto } from '../../../api/generated/model'
import { ModalFrame } from '../../../core/ui/ModalFrame'
import { ToastProvider } from '../../../core/ui/Toast'
import { useIsDesktop } from '../../../core/useIsDesktop'
import FinanceLineSheet from '../components/FinanceLineSheet'
import MonMoisPage from './MonMoisPage'

vi.mock('../../../api/generated/endpoints/finances/finances', () => ({
  financeLinesList: vi.fn(),
  financeLinesCreate: vi.fn(),
  financeLinesUpdate: vi.fn(),
  financeLinesRemove: vi.fn(),
}))
vi.mock('../../../core/useIsDesktop', () => ({ useIsDesktop: vi.fn(() => false) }))

let n = 0
const line = (
  kind: FinanceLineDto['kind'],
  name: string,
  amountCents: number,
  category: FinanceLineDto['category'] = null,
): FinanceLineDto => ({ id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, kind, name, amountCents, category })

/** The mockup's typical month. */
const MOCKUP = (): FinanceLineDto[] => [
  line('income', 'Freelance', 20_000),
  line('income', 'Salaire', 265_000),
  line('expense', 'Charges', 6_000, 'housing'),
  line('expense', 'Loyer', 85_000, 'housing'),
  line('expense', 'Électricité', 4_500, 'housing'),
  line('expense', 'Internet', 3_000, 'housing'),
  line('expense', 'Assurance habitation', 1_200, 'housing'),
  line('expense', 'Navigo', 8_640, 'subscriptions'),
  line('expense', 'Mutuelle', 3_500, 'subscriptions'),
  line('expense', 'Salle de sport', 3_000, 'subscriptions'),
  line('expense', 'Téléphone', 1_500, 'subscriptions'),
  line('expense', 'Netflix', 1_300, 'subscriptions'),
  line('expense', 'Spotify', 1_100, 'subscriptions'),
  line('expense', 'Livret A', 20_000, 'savings'),
]

// fr-FR groups thousands with a (narrow) no-break space.
const text = (el: HTMLElement) => (el.textContent ?? '').replace(/[  ]/g, ' ')

function App() {
  const location = useLocation()
  const background = (location.state as { background?: Location } | null)?.background
  return (
    <>
      <Routes location={background ?? location}>
        <Route path="/finances" element={<MonMoisPage />} />
        <Route path="/finances/nouveau" element={<FinanceLineSheet />} />
        <Route path="/finances/:id" element={<FinanceLineSheet />} />
      </Routes>
      {background && (
        <Routes>
          <Route path="/finances/nouveau" element={<ModalFrame label="Ajouter"><FinanceLineSheet /></ModalFrame>} />
          <Route path="/finances/:id" element={<ModalFrame label="Modifier"><FinanceLineSheet /></ModalFrame>} />
        </Routes>
      )}
    </>
  )
}

async function open(lines: FinanceLineDto[]) {
  vi.mocked(financeLinesList).mockResolvedValue(lines)
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/finances']}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </MemoryRouter>,
  )
  await screen.findByTestId('rest')
  return user
}

const expenses = () => screen.getByRole('region', { name: 'Dépenses' })
const categories = () => within(expenses()).getAllByRole('group').map((g) => g.getAttribute('aria-label'))

describe('Mon mois', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useIsDesktop).mockReturnValue(false)
  })

  it('shows the totals of the mockup: Entrées 2 850 €, Dépenses 1 387,40 €, Reste 1 462,60 €', async () => {
    await open(MOCKUP())
    expect(text(screen.getByTestId('rest'))).toBe('1 462,60 €')
    expect(screen.getByTestId('rest')).not.toHaveClass(/negative/)
    const incomes = screen.getByRole('region', { name: 'Entrées' })
    expect(text(incomes)).toContain('2 850 €')
    expect(text(expenses())).toContain('1 387,40 €')
    // Sorted by amount, highest first.
    expect(within(incomes).getAllByRole('link').map((a) => a.firstChild?.textContent)).toEqual(['Salaire', 'Freelance'])
    const housing = within(expenses()).getByRole('group', { name: 'Logement' })
    expect(text(housing)).toContain('997 €')
    expect(within(housing).getAllByRole('link')[0]).toHaveTextContent('Loyer')
  })

  it('hides a category with no line, in the order Logement, Abonnements, Épargne, Autre', async () => {
    await open(MOCKUP())
    expect(categories()).toEqual(['Logement', 'Abonnements', 'Épargne'])
  })

  it('shows an "Autre" section once a line has that category', async () => {
    await open([...MOCKUP(), line('expense', 'Cadeaux', 5_000, 'other')])
    expect(categories()).toEqual(['Logement', 'Abonnements', 'Épargne', 'Autre'])
  })

  it('negative Reste: "−" in the over colour', async () => {
    await open([line('income', 'Salaire', 100_000), line('expense', 'Loyer', 120_000, 'housing')])
    expect(text(screen.getByTestId('rest'))).toBe('−200 €')
    expect(screen.getByTestId('rest').className).toMatch(/negative/)
  })

  it('empty state: the ring at 0 €, no section', async () => {
    await open([])
    expect(text(screen.getByTestId('rest'))).toBe('0 €')
    expect(screen.queryByRole('region', { name: 'Entrées' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Dépenses' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Ajouter' })).toBeInTheDocument()
  })

  it('desktop: legend with the % of Entrées and the two inner columns', async () => {
    vi.mocked(useIsDesktop).mockReturnValue(true)
    await open(MOCKUP())
    const legend = text(document.querySelector('[class*="legend"]') as HTMLElement)
    expect(legend).toContain('Logement35 %997 €')
    expect(legend).toContain('Abonnements7 %190,40 €')
    expect(legend).toContain('Épargne7 %200 €')
    expect(legend).toContain('Reste51 %1 462,60 €')
    expect(legend).not.toContain('Autre')
    // Logement then Épargne on the left; Abonnements on the right.
    expect(categories()).toEqual(['Logement', 'Épargne', 'Abonnements'])
  })
})

describe('Ajouter / Modifier', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useIsDesktop).mockReturnValue(false)
  })

  it('the Entrée type hides Catégorie and saves no category', async () => {
    const user = await open([])
    vi.mocked(financeLinesCreate).mockResolvedValue(line('income', 'Salaire', 265_000))
    await user.click(screen.getByRole('link', { name: 'Ajouter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ajouter' })
    expect(within(dialog).getByRole('group', { name: 'Catégorie' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('radio', { name: 'Entrée' }))
    expect(within(dialog).queryByRole('group', { name: 'Catégorie' })).toBeNull()
    await user.type(within(dialog).getByLabelText('Nom'), 'Salaire')
    await user.type(within(dialog).getByLabelText('Montant'), '2650')
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    expect(financeLinesCreate).toHaveBeenCalledWith({
      kind: 'income',
      name: 'Salaire',
      amountCents: 265_000,
      category: null,
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('an expense needs a category before Enregistrer is enabled', async () => {
    const user = await open([])
    vi.mocked(financeLinesCreate).mockResolvedValue(line('expense', 'Netflix', 1_300, 'subscriptions'))
    await user.click(screen.getByRole('link', { name: 'Ajouter' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Nom'), 'Netflix')
    await user.type(within(dialog).getByLabelText('Montant'), '13,00')
    const save = within(dialog).getByRole('button', { name: 'Enregistrer' })
    expect(save).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Abonnements' }))
    expect(save).toBeEnabled()
    await user.click(save)
    expect(financeLinesCreate).toHaveBeenCalledWith({
      kind: 'expense',
      name: 'Netflix',
      amountCents: 1_300,
      category: 'subscriptions',
    })
  })

  it('editing the rent from 850 to 900 updates the totals', async () => {
    const lines = MOCKUP()
    const user = await open(lines)
    const rent = lines.find((l) => l.name === 'Loyer')!
    vi.mocked(financeLinesUpdate).mockResolvedValue({ ...rent, amountCents: 90_000 })
    await user.click(screen.getByRole('link', { name: /Loyer/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Modifier' })
    const amount = await within(dialog).findByLabelText('Montant')
    expect(amount).toHaveValue('850')
    expect(within(dialog).getByRole('button', { name: 'Logement' })).toHaveAttribute('aria-pressed', 'true')
    await user.clear(amount)
    await user.type(amount, '900')
    vi.mocked(financeLinesList).mockResolvedValue(lines.map((l) => (l === rent ? { ...l, amountCents: 90_000 } : l)))
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    expect(financeLinesUpdate).toHaveBeenCalledWith(rent.id, {
      kind: 'expense',
      name: 'Loyer',
      amountCents: 90_000,
      category: 'housing',
    })
    await waitFor(() => expect(text(screen.getByTestId('rest'))).toBe('1 412,60 €'))
  })

  it('Supprimer deletes right away; Annuler in the toast restores the line', async () => {
    const lines = MOCKUP()
    const user = await open(lines)
    const netflix = lines.find((l) => l.name === 'Netflix')!
    vi.mocked(financeLinesRemove).mockResolvedValue(undefined)
    vi.mocked(financeLinesCreate).mockResolvedValue({ ...netflix, id: 'new' })
    await user.click(screen.getByRole('link', { name: /Netflix/ }))
    const dialog = await screen.findByRole('dialog')
    vi.mocked(financeLinesList).mockResolvedValue(lines.filter((l) => l !== netflix))
    await user.click(await within(dialog).findByRole('button', { name: 'Supprimer' }))
    expect(financeLinesRemove).toHaveBeenCalledWith(netflix.id)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(screen.queryByRole('link', { name: /Netflix/ })).toBeNull())

    vi.mocked(financeLinesList).mockResolvedValue(lines)
    await user.click(await screen.findByRole('button', { name: 'Annuler' }))
    expect(financeLinesCreate).toHaveBeenCalledWith({
      kind: 'expense',
      name: 'Netflix',
      amountCents: 1_300,
      category: 'subscriptions',
    })
    expect(await screen.findByRole('link', { name: /Netflix/ })).toBeInTheDocument()
  })
})
