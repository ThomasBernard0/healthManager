import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { exercisesList } from '../../../api/generated/endpoints/exercises/exercises'
import {
  workoutsCreate,
  workoutsGet,
  workoutsList,
  workoutsRemove,
  workoutsUpdate,
} from '../../../api/generated/endpoints/workouts/workouts'
import type { ExerciseDto, WorkoutDto, WorkoutSummaryDto } from '../../../api/generated/model'
import { ToastProvider } from '../../../core/ui/Toast'
import HomePage from './HomePage'
import WorkoutEditPage from './WorkoutEditPage'

vi.mock('../../../api/generated/endpoints/workouts/workouts', () => ({
  workoutsList: vi.fn(),
  workoutsGet: vi.fn(),
  workoutsCreate: vi.fn(),
  workoutsUpdate: vi.fn(),
  workoutsRemove: vi.fn(),
}))
vi.mock('../../../api/generated/endpoints/exercises/exercises', () => ({ exercisesList: vi.fn() }))

const ex = (id: string, name: string, primary: ExerciseDto['primaryMuscles'] = ['back']): ExerciseDto => ({
  id,
  name,
  equipment: 'machine',
  primaryMuscles: primary,
  secondaryMuscles: [],
  imageUrl: null,
  workouts: [],
})
const TIRAGE = ex('t', 'Tirage vertical prise large')
const ROWING = ex('r', 'Rowing barre')
const CURL = ex('c', 'Curl haltères', ['biceps'])

const summary = (id: string, name: string, position: number, names: string[], extra: Partial<WorkoutSummaryDto> = {}) => ({
  id,
  name,
  position,
  exerciseNames: names,
  lastDoneOn: null,
  isNext: false,
  ...extra,
})

const PULL: WorkoutDto = {
  id: 'pull',
  name: 'Pull',
  position: 2,
  items: [
    { exercise: TIRAGE, sets: 4, repMin: 8, repMax: 12 },
    { exercise: ROWING, sets: 4, repMin: 8, repMax: 12 },
  ],
}

function Where() {
  const l = useLocation()
  return <div data-testid="where">{l.pathname}</div>
}

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/muscu', path]}>
        <Routes>
          <Route path="/muscu" element={<><HomePage /><Where /></>} />
          <Route path="/muscu/seances/nouvelle" element={<WorkoutEditPage />} />
          <Route path="/muscu/seances/:id" element={<WorkoutEditPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

describe('Accueil', () => {
  beforeEach(() => vi.resetAllMocks())

  it('shows the next workout and the rotation, the next one tagged', async () => {
    vi.mocked(workoutsList).mockResolvedValue([
      summary('a', 'Push A', 1, ['Développé couché barre'], { lastDoneOn: '2026-10-05' }),
      summary('pull', 'Pull', 2, ['Tirage vertical prise large', 'Rowing barre'], { isNext: true, lastDoneOn: '2026-09-28' }),
    ])
    render(
      <MemoryRouter initialEntries={['/muscu']}>
        <HomePage />
      </MemoryRouter>,
    )
    const next = await screen.findByRole('region', { name: 'Prochaine séance' })
    expect(within(next).getByText('Pull')).toBeInTheDocument()
    expect(within(next).getByText('Dernière : lun 28 sept')).toBeInTheDocument()
    expect(within(next).getByText('Tirage vertical prise large, Rowing barre')).toBeInTheDocument()

    const rows = screen
      .getAllByRole('link')
      .filter((l) => /^\/muscu\/seances\/(?!nouvelle)/.test(l.getAttribute('href') ?? ''))
    expect(rows.map((r) => r.textContent)).toEqual(['1Push A1 exercice · lun 5 oct', '2Pull2 exercices · lun 28 septSuivante'])
    expect(screen.getByRole('link', { name: '+ Nouvelle séance' })).toHaveAttribute('href', '/muscu/seances/nouvelle')
  })

  it('has no next workout card without workouts', async () => {
    vi.mocked(workoutsList).mockResolvedValue([])
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    await screen.findByRole('link', { name: '+ Nouvelle séance' })
    expect(screen.queryByRole('region', { name: 'Prochaine séance' })).toBeNull()
  })
})

describe('Modifier la séance', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(workoutsList).mockResolvedValue([])
  })

  it('creates a workout from the bank in picking mode, 4 × 8–12 by default', async () => {
    vi.mocked(exercisesList).mockResolvedValue([CURL, ROWING])
    vi.mocked(workoutsCreate).mockResolvedValue(PULL)
    const user = userEvent.setup()
    renderAt('/muscu/seances/nouvelle')

    await user.type(await screen.findByRole('textbox', { name: 'Nom' }), 'Bras')
    await user.click(screen.getByRole('button', { name: '+ Ajouter un exercice' }))
    const picker = await screen.findByRole('dialog', { name: 'Exercices' })
    await user.click(await within(picker).findByRole('button', { name: 'Ajouter Curl haltères à la séance' }))
    // Already in it: the workout name instead of "+".
    expect(within(picker).queryByRole('button', { name: 'Ajouter Curl haltères à la séance' })).toBeNull()
    expect(within(picker).getByText('Bras')).toBeInTheDocument()
    await user.click(within(picker).getByRole('button', { name: 'Retour' }))

    expect(screen.getByRole('button', { name: 'Modifier Curl haltères : séries et répétitions' })).toHaveTextContent('4 × 8–12')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(workoutsCreate).toHaveBeenCalledWith({
      name: 'Bras',
      items: [{ exerciseId: 'c', sets: 4, repMin: 8, repMax: 12 }],
    })
    expect(await screen.findByTestId('where')).toHaveTextContent('/muscu')
  })

  it('edits sets and rep range, reorders with the keyboard and saves', async () => {
    vi.mocked(workoutsGet).mockResolvedValue(PULL)
    vi.mocked(workoutsUpdate).mockResolvedValue(PULL)
    const user = userEvent.setup()
    renderAt('/muscu/seances/pull')

    await user.click(await screen.findByRole('button', { name: 'Modifier Rowing barre : séries et répétitions' }))
    const sheet = await screen.findByRole('dialog', { name: 'Rowing barre' })
    await user.click(within(sheet).getByRole('button', { name: 'Séries : moins' }))
    for (let i = 0; i < 5; i++) await user.click(within(sheet).getByRole('button', { name: 'Répétitions min : plus' }))
    // min 13 pushed the max up to 13.
    await user.click(within(sheet).getByRole('button', { name: 'OK' }))
    expect(screen.getByRole('button', { name: 'Modifier Rowing barre : séries et répétitions' })).toHaveTextContent('3 × 13–13')

    screen.getByRole('button', { name: 'Déplacer Rowing barre' }).focus()
    await user.keyboard('{ArrowUp}')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(workoutsUpdate).toHaveBeenCalledWith('pull', {
      name: 'Pull',
      items: [
        { exerciseId: 'r', sets: 3, repMin: 13, repMax: 13 },
        { exerciseId: 't', sets: 4, repMin: 8, repMax: 12 },
      ],
    })
  })

  it('removes an exercise with a swipe, and Annuler puts it back in place', async () => {
    vi.mocked(workoutsGet).mockResolvedValue(PULL)
    const user = userEvent.setup()
    renderAt('/muscu/seances/pull')
    const name = await screen.findByText('Tirage vertical prise large')
    const row = name.closest('li')!.firstElementChild!
    fireEvent.pointerDown(row, { pointerType: 'touch', clientX: 300 })
    fireEvent.pointerMove(row, { pointerType: 'touch', clientX: 150 })
    fireEvent.pointerUp(row, { pointerType: 'touch', clientX: 150 })
    expect(screen.queryByText('Tirage vertical prise large')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    const names = screen.getAllByRole('button', { name: /^Déplacer / }).map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(['Déplacer Tirage vertical prise large', 'Déplacer Rowing barre'])
  })

  it('deletes the workout after confirmation', async () => {
    vi.mocked(workoutsGet).mockResolvedValue(PULL)
    vi.mocked(workoutsRemove).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderAt('/muscu/seances/pull')
    await user.click(await screen.findByRole('button', { name: 'Supprimer la séance' }))
    const confirm = screen.getByRole('dialog', { name: 'Supprimer « Pull » ?' })
    await user.click(within(confirm).getByRole('button', { name: 'Supprimer' }))
    expect(workoutsRemove).toHaveBeenCalledWith('pull')
    expect(await screen.findByTestId('where')).toHaveTextContent('/muscu')
  })
})
