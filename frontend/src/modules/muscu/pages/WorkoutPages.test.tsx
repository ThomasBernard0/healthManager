import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { exercisesCreate, exercisesList } from '../../../api/generated/endpoints/exercises/exercises'
import {
  workoutsCreate,
  workoutsGet,
  workoutsList,
  workoutsRemove,
  workoutsUpdate,
} from '../../../api/generated/endpoints/workouts/workouts'
import type { ExerciseDto, WorkoutDto, WorkoutSummaryDto } from '../../../api/generated/model'
import { sessionsCurrent, sessionsStart } from '../../../api/generated/endpoints/sessions/sessions'
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
vi.mock('../../../api/generated/endpoints/exercises/exercises', () => ({ exercisesList: vi.fn(), exercisesCreate: vi.fn() }))
vi.mock('../../../api/generated/endpoints/sessions/sessions', () => ({ sessionsCurrent: vi.fn(), sessionsStart: vi.fn() }))

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

const summary = (
  id: string,
  name: string,
  position: number,
  names: string[],
  extra: Partial<WorkoutSummaryDto> = {},
): WorkoutSummaryDto => ({
  id,
  name,
  position,
  exercises: names.map((n) => ({ name: n, targets: null })),
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
      <MemoryRouter initialEntries={path === '/muscu' ? [path] : ['/muscu', path]}>
        <Routes>
          <Route path="/muscu" element={<><HomePage /><Where /></>} />
          <Route path="/muscu/seances/nouvelle" element={<WorkoutEditPage />} />
          <Route path="/muscu/seances/:id" element={<WorkoutEditPage />} />
          <Route path="/muscu/seance/:sessionId" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

describe('Accueil', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(sessionsCurrent).mockResolvedValue({ session: null })
    vi.mocked(exercisesList).mockResolvedValue([])
  })

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

  it('Démarrer starts the next workout and opens the session; a session in progress shows Reprendre', async () => {
    vi.mocked(workoutsList).mockResolvedValue([summary('pull', 'Pull', 1, ['Rowing barre'], { isNext: true })])
    vi.mocked(sessionsStart).mockResolvedValue({
      id: 's1',
      workoutId: 'pull',
      workoutName: 'Pull',
      startedAt: '2026-10-10T08:00:00.000Z',
      finishedAt: null,
      exercises: [],
    })
    const user = userEvent.setup()
    renderAt('/muscu')
    await user.click(await screen.findByRole('button', { name: 'Démarrer' }))
    expect(sessionsStart).toHaveBeenCalledWith({ workoutId: 'pull' })
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu/seance/s1'))
  })

  it('shows the session in progress instead of the next workout', async () => {
    vi.mocked(workoutsList).mockResolvedValue([summary('pull', 'Pull', 1, ['Rowing barre'], { isNext: true })])
    vi.mocked(sessionsCurrent).mockResolvedValue({
      session: {
        id: 's9',
        workoutId: 'a',
        workoutName: 'Push A',
        startedAt: '2026-10-10T08:00:00.000Z',
        finishedAt: null,
        exercises: [{ id: 'e1', exercise: TIRAGE, status: 'todo', preFatigue: 0 }],
      },
    })
    const user = userEvent.setup()
    renderAt('/muscu')
    const card = await screen.findByRole('region', { name: 'Séance en cours' })
    expect(within(card).getByText('Push A')).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Reprendre la séance' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu/seance/s9'))
  })

  it('lists Mes exercices (only those in my séances, once) and has no Exercices link', async () => {
    const inPull = { id: 'pull', name: 'Pull', sets: 4, repMin: 8, repMax: 12 }
    const inPushA = { id: 'a', name: 'Push A', sets: 4, repMin: 8, repMax: 12 }
    vi.mocked(workoutsList).mockResolvedValue([summary('pull', 'Pull', 1, ['Rowing barre'], { isNext: true })])
    vi.mocked(exercisesList).mockResolvedValue([
      { ...CURL, workouts: [inPull, inPushA] },
      { ...ROWING, workouts: [inPull] },
      TIRAGE,
    ])
    renderAt('/muscu')
    const section = (await screen.findByRole('heading', { name: 'Mes exercices' })).closest('section')!
    const links = within(section).getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/muscu/exercices/c', '/muscu/exercices/r'])
    expect(within(section).queryByText('Tirage vertical prise large')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Exercices' })).toBeNull()
    // Mobile order: next workout, my exercises, my séances.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Mes exercices', 'Mes séances'])
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
    vi.mocked(sessionsCurrent).mockResolvedValue({ session: null })
    vi.mocked(exercisesList).mockResolvedValue([])
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
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu'))
  })

  it('creates a custom exercise from the picker and adds it to the séance (4 × 8–12)', async () => {
    const pullover = { ...ex('po', 'Pull-over', ['back']), equipment: 'dumbbell' as const }
    vi.mocked(exercisesList).mockResolvedValue([CURL])
    vi.mocked(exercisesCreate).mockResolvedValue(pullover)
    const user = userEvent.setup()
    renderAt('/muscu/seances/nouvelle')

    await user.click(await screen.findByRole('button', { name: '+ Ajouter un exercice' }))
    await user.click(await screen.findByRole('button', { name: '+ Créer un exercice' }))
    const sheet = await screen.findByRole('dialog', { name: 'Créer un exercice' })
    await user.type(within(sheet).getByRole('textbox', { name: 'Nom' }), 'Pull-over')
    await user.click(within(sheet).getByRole('button', { name: 'Haltères' }))
    await user.click(within(sheet).getByRole('button', { name: 'Dos : non travaillé' }))
    await user.click(within(sheet).getByRole('button', { name: 'Dos : secondaire' }))
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }))

    expect(exercisesCreate).toHaveBeenCalledWith({
      name: 'Pull-over',
      equipment: 'dumbbell',
      primaryMuscles: ['back'],
      secondaryMuscles: [],
    })
    expect(await screen.findByRole('button', { name: 'Modifier Pull-over : séries et répétitions' })).toHaveTextContent(
      '4 × 8–12',
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    // Many typed/clicked steps: room for a loaded CI machine.
  }, 15000)

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
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu'))
  })
})
