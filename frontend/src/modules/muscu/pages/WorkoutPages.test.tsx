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
import {
  programsActivate,
  programsCreate,
  programsGet,
  programsList,
  programsRemove,
  programsUpdate,
} from '../../../api/generated/endpoints/programs/programs'
import type {
  ExerciseDto,
  ExerciseWorkoutDto,
  ProgramDto,
  ProgramSummaryDto,
  WorkoutDto,
  WorkoutSummaryDto,
} from '../../../api/generated/model'
import { sessionsCurrent, sessionsStart } from '../../../api/generated/endpoints/sessions/sessions'
import { ToastProvider } from '../../../core/ui/Toast'
import HomePage from './HomePage'
import ProgramPage from './ProgramPage'
import WorkoutEditPage from './WorkoutEditPage'

vi.mock('../../../api/generated/endpoints/workouts/workouts', () => ({
  workoutsList: vi.fn(),
  workoutsGet: vi.fn(),
  workoutsCreate: vi.fn(),
  workoutsUpdate: vi.fn(),
  workoutsRemove: vi.fn(),
}))
vi.mock('../../../api/generated/endpoints/programs/programs', () => ({
  programsList: vi.fn(),
  programsGet: vi.fn(),
  programsCreate: vi.fn(),
  programsUpdate: vi.fn(),
  programsRemove: vi.fn(),
  programsActivate: vi.fn(),
}))
vi.mock('../../../api/generated/endpoints/exercises/exercises', () => ({ exercisesList: vi.fn(), exercisesCreate: vi.fn() }))
vi.mock('../../../api/generated/endpoints/sessions/sessions', () => ({ sessionsCurrent: vi.fn(), sessionsStart: vi.fn() }))

const ex = (id: string, name: string, primary: ExerciseDto['primaryMuscles'] = ['back']): ExerciseDto => ({
  id,
  name,
  equipment: 'machine',
  primaryMuscles: primary,
  secondaryMuscles: [],
  sets: 4,
  repMin: 8,
  repMax: 12,
  imageVersion: null,
  workouts: [],
})
const TIRAGE = ex('t', 'Tirage vertical prise large')
const ROWING = ex('r', 'Rowing barre')
/** 3 × 12–15 */
const CURL: ExerciseDto = { ...ex('c', 'Curl haltères', ['biceps']), sets: 3, repMin: 12, repMax: 15 }

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

const program = (id: string, name: string, active: boolean, workoutCount = 2): ProgramSummaryDto => ({
  id,
  name,
  position: 1,
  active,
  workoutCount,
})
const PUSH_PULL = program('pp', 'Push Pull', true)
const LEGS = program('legs', 'Jambes', false, 3)

/** The exercise is in this workout. */
const inWorkout = (id: string, name: string, programId = 'pp', programActive = true): ExerciseWorkoutDto => ({
  id,
  name,
  programId,
  programActive,
})

const PULL: WorkoutDto = {
  id: 'pull',
  name: 'Pull',
  position: 2,
  programId: 'pp',
  programActive: true,
  items: [
    { exercise: TIRAGE, group: null },
    { exercise: ROWING, group: null },
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
          <Route path="/muscu/programmes/:id" element={<><ProgramPage /><Where /></>} />
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
    vi.mocked(programsList).mockResolvedValue([PUSH_PULL])
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
    // Last row of the active program's card.
    const card = screen.getByText('Actif').closest('a')!.parentElement!
    const cardLinks = within(card).getAllByRole('link')
    expect(cardLinks.at(-1)).toHaveAccessibleName('Nouvelle séance')
    expect(cardLinks.at(-1)).toHaveAttribute('href', '/muscu/seances/nouvelle')
  })

  it('has no Nouvelle séance link without an active program', async () => {
    vi.mocked(programsList).mockResolvedValue([LEGS])
    vi.mocked(workoutsList).mockResolvedValue([])
    renderAt('/muscu')
    await screen.findByRole('button', { name: '+ Nouveau programme' })
    expect(screen.queryByRole('link', { name: 'Nouvelle séance' })).toBeNull()
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
        exercises: [{ id: 'e1', exercise: TIRAGE, status: 'todo', preFatigue: 0, supersetGroup: null }],
      },
    })
    const user = userEvent.setup()
    renderAt('/muscu')
    const card = await screen.findByRole('region', { name: 'Séance en cours' })
    expect(within(card).getByText('Push A')).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Reprendre la séance' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu/seance/s9'))
  })

  it('lists Mes exercices (only those of the active program, once) and has no Exercices link', async () => {
    const inPull = inWorkout('pull', 'Pull')
    const inPushA = inWorkout('a', 'Push A')
    vi.mocked(workoutsList).mockResolvedValue([summary('pull', 'Pull', 1, ['Rowing barre'], { isNext: true })])
    vi.mocked(exercisesList).mockResolvedValue([
      { ...CURL, workouts: [inPull, inPushA] },
      { ...ROWING, workouts: [inPull] },
      { ...TIRAGE, workouts: [inWorkout('squat', 'Jambes A', 'legs', false)] },
    ])
    renderAt('/muscu')
    const section = (await screen.findByRole('heading', { name: 'Mes exercices' })).closest('section')!
    const links = within(section).getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/muscu/exercices/c', '/muscu/exercices/r'])
    expect(within(section).queryByText('Tirage vertical prise large')).toBeNull()
    expect(within(section).getByRole('button', { name: 'Programme actif' })).toHaveAttribute('aria-pressed', 'true')
    // The other tab: exercises only in inactive programs.
    await userEvent.setup().click(within(section).getByRole('button', { name: 'Autres programmes' }))
    expect(within(section).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/muscu/exercices/t'])
    expect(screen.queryByRole('link', { name: 'Exercices' })).toBeNull()
    // Mobile order: next workout, my exercises, my programs.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Mes exercices',
      'Mes programmes',
    ])
  })

  it('shows the active program on top with its séances, the others below with Activer', async () => {
    vi.mocked(programsList).mockResolvedValue([PUSH_PULL, LEGS])
    vi.mocked(workoutsList).mockResolvedValue([summary('pull', 'Pull', 1, ['Rowing barre'], { isNext: true })])
    vi.mocked(programsActivate).mockResolvedValue({ ...LEGS, active: true, workouts: [] })
    const user = userEvent.setup()
    renderAt('/muscu')
    const section = (await screen.findByRole('heading', { name: 'Mes programmes' })).closest('section')!
    const programLinks = within(section)
      .getAllByRole('link')
      .filter((l) => l.getAttribute('href')?.startsWith('/muscu/programmes/'))
    expect(programLinks.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Push PullActif', '/muscu/programmes/pp'],
      ['Jambes3 séances', '/muscu/programmes/legs'],
    ])
    expect(within(section).getByText('Suivante')).toBeInTheDocument()
    // Only the other programs can be activated.
    expect(within(section).getAllByRole('button', { name: /^Activer/ })).toHaveLength(1)
    await user.click(within(section).getByRole('button', { name: 'Activer Jambes' }))
    // Asked first; Annuler changes nothing.
    await user.click(within(screen.getByRole('dialog', { name: 'Activer « Jambes » ?' })).getByRole('button', { name: 'Annuler' }))
    expect(programsActivate).not.toHaveBeenCalled()
    await user.click(within(section).getByRole('button', { name: 'Activer Jambes' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Activer « Jambes » ?' })).getByRole('button', { name: 'Activer' }))
    expect(programsActivate).toHaveBeenCalledWith('legs')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(programsList).toHaveBeenCalledTimes(2))
  })

  it('creates a program and opens its page', async () => {
    vi.mocked(workoutsList).mockResolvedValue([])
    vi.mocked(programsCreate).mockResolvedValue({ ...LEGS, workouts: [] })
    vi.mocked(programsGet).mockResolvedValue({ ...LEGS, workouts: [] })
    const user = userEvent.setup()
    renderAt('/muscu')
    await user.click(await screen.findByRole('button', { name: '+ Nouveau programme' }))
    const sheet = await screen.findByRole('dialog', { name: 'Nouveau programme' })
    await user.type(within(sheet).getByRole('textbox', { name: 'Nom' }), ' Jambes ')
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }))
    expect(programsCreate).toHaveBeenCalledWith({ name: 'Jambes' })
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu/programmes/legs'))
  })

  it('has no next workout card without workouts', async () => {
    vi.mocked(workoutsList).mockResolvedValue([])
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    await screen.findByRole('link', { name: 'Nouvelle séance' })
    expect(screen.queryByRole('region', { name: 'Prochaine séance' })).toBeNull()
  })
})

describe('Modifier la séance', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(workoutsList).mockResolvedValue([])
    vi.mocked(programsList).mockResolvedValue([PUSH_PULL])
    vi.mocked(sessionsCurrent).mockResolvedValue({ session: null })
    vi.mocked(exercisesList).mockResolvedValue([])
  })

  it('creates a workout from my exercises in picking mode, each with its own sets × rep range (read-only)', async () => {
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

    // The scheme of the exercise: plain text, nothing to tap.
    const scheme = screen.getByText('3 × 12–15')
    expect(scheme.tagName).toBe('SPAN')
    expect(scheme.closest('button, a')).toBeNull()
    await user.click(scheme)
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(workoutsCreate).toHaveBeenCalledWith({ name: 'Bras', items: [{ exerciseId: 'c' }] })
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu'))
  })

  it('creates a custom exercise (with its sets × rep range) from the picker and adds it to the séance', async () => {
    const pullover = { ...ex('po', 'Pull-over', ['back']), equipment: 'dumbbell' as const, sets: 3 }
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
    const sets = within(sheet).getByRole('textbox', { name: 'Nombre de séries' })
    await user.clear(sets)
    await user.type(sets, '3')
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }))

    expect(exercisesCreate).toHaveBeenCalledWith({
      name: 'Pull-over',
      equipment: 'dumbbell',
      primaryMuscles: ['back'],
      secondaryMuscles: [],
      sets: 3,
      repMin: 8,
      repMax: 12,
    })
    expect((await screen.findByText('Pull-over')).closest('li')).toHaveTextContent('3 × 8–12')
    expect(screen.queryByRole('dialog')).toBeNull()
    // Many typed/clicked steps: room for a loaded CI machine.
  }, 15000)

  it('shows the sets × rep range of each exercise, reorders with the keyboard and saves', async () => {
    vi.mocked(workoutsGet).mockResolvedValue({ ...PULL, items: [{ exercise: TIRAGE, group: null }, { exercise: { ...ROWING, sets: 3, repMin: 6, repMax: 10 }, group: null }] })
    vi.mocked(workoutsUpdate).mockResolvedValue(PULL)
    const user = userEvent.setup()
    renderAt('/muscu/seances/pull')

    expect((await screen.findByText('Rowing barre')).closest('li')).toHaveTextContent('3 × 6–10')
    expect(screen.getByText('Tirage vertical prise large').closest('li')).toHaveTextContent('4 × 8–12')
    // Nothing to edit here: sets and rep range are set in Modifier l'exercice.
    expect(screen.queryByRole('button', { name: /séries et répétitions/ })).toBeNull()

    screen.getByRole('button', { name: 'Déplacer Rowing barre' }).focus()
    await user.keyboard('{ArrowUp}')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(workoutsUpdate).toHaveBeenCalledWith('pull', {
      name: 'Pull',
      items: [{ exerciseId: 'r' }, { exerciseId: 't' }],
    })
  })

  describe('supersets', () => {
    const item = (exercise: ExerciseDto, group: string | null = null) => ({ exercise, group })
    const saved = (exerciseId: string, group?: string) => ({ exerciseId, ...(group ? { group } : {}) })
    const THREE: WorkoutDto = { ...PULL, items: [item(TIRAGE), item(ROWING), item(CURL)] }
    const LINKED: WorkoutDto = { ...PULL, items: [item(TIRAGE), item(ROWING, 'g'), item(CURL, 'g')] }
    const save = () => userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    it('links two consecutive exercises: one block with A and B, no link button around it', async () => {
      vi.mocked(workoutsGet).mockResolvedValue(THREE)
      vi.mocked(workoutsUpdate).mockResolvedValue(THREE)
      const user = userEvent.setup()
      renderAt('/muscu/seances/pull')

      const links = await screen.findAllByRole('button', { name: 'Relier en superset' })
      expect(links).toHaveLength(2)
      await user.click(links[1])

      const block = screen.getByRole('button', { name: 'Délier le superset' }).closest('li')!
      expect(within(block).getByText('Superset')).toBeInTheDocument()
      expect(within(block).getByText('A').parentElement).toHaveTextContent('Rowing barre')
      expect(within(block).getByText('B').parentElement).toHaveTextContent('Curl haltères')
      // Each keeps its own sets × rep range.
      expect(within(block).getByText('A').parentElement).toHaveTextContent('4 × 8–12')
      expect(within(block).getByText('B').parentElement).toHaveTextContent('3 × 12–15')
      // Tirage is next to a superset: nothing left to link.
      expect(screen.queryByRole('button', { name: 'Relier en superset' })).toBeNull()

      await save()
      expect(workoutsUpdate).toHaveBeenCalledWith('pull', {
        name: 'Pull',
        items: [saved('t'), saved('r', 'r'), saved('c', 'r')],
      })
    })

    it('unlinks: both exercises stay, with their sets × rep range and their order', async () => {
      vi.mocked(workoutsGet).mockResolvedValue(LINKED)
      vi.mocked(workoutsUpdate).mockResolvedValue(THREE)
      const user = userEvent.setup()
      renderAt('/muscu/seances/pull')

      await user.click(await screen.findByRole('button', { name: 'Délier le superset' }))
      expect(screen.queryByText('Superset')).toBeNull()
      expect(screen.getAllByRole('button', { name: 'Relier en superset' })).toHaveLength(2)
      expect(screen.getByText('Curl haltères').closest('li')).toHaveTextContent('3 × 12–15')

      await save()
      expect(workoutsUpdate).toHaveBeenCalledWith('pull', {
        name: 'Pull',
        items: [saved('t'), saved('r'), saved('c')],
      })
    })

    it('moves the superset as one block, and an exercise over it', async () => {
      vi.mocked(workoutsGet).mockResolvedValue(LINKED)
      vi.mocked(workoutsUpdate).mockResolvedValue(LINKED)
      const user = userEvent.setup()
      renderAt('/muscu/seances/pull')

      ;(await screen.findByRole('button', { name: 'Déplacer le superset' })).focus()
      await user.keyboard('{ArrowUp}')
      await save()
      expect(workoutsUpdate).toHaveBeenLastCalledWith('pull', {
        name: 'Pull',
        items: [saved('r', 'g'), saved('c', 'g'), saved('t')],
      })
    })

    it('removing an exercise next to a superset keeps the pair; Annuler puts it back before it', async () => {
      vi.mocked(workoutsGet).mockResolvedValue(LINKED)
      const user = userEvent.setup()
      renderAt('/muscu/seances/pull')

      const row = (await screen.findByText('Tirage vertical prise large')).closest('li')!.firstElementChild!
      fireEvent.pointerDown(row, { pointerType: 'touch', clientX: 300 })
      fireEvent.pointerMove(row, { pointerType: 'touch', clientX: 150 })
      fireEvent.pointerUp(row, { pointerType: 'touch', clientX: 150 })
      expect(screen.queryByText('Tirage vertical prise large')).toBeNull()
      const block = screen.getByRole('button', { name: 'Délier le superset' }).closest('li')!
      expect(within(block).getByText('B').parentElement).toHaveTextContent('Curl haltères')

      await user.click(screen.getByRole('button', { name: 'Annuler' }))
      expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Tirage vertical prise large')
      expect(screen.getByRole('button', { name: 'Délier le superset' })).toBeInTheDocument()
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

  it('starts this workout from the link under Enregistrer (no séance in progress)', async () => {
    vi.mocked(workoutsGet).mockResolvedValue(PULL)
    vi.mocked(sessionsStart).mockResolvedValue({
      id: 's7',
      workoutId: 'pull',
      workoutName: 'Pull',
      startedAt: '2026-10-11T08:00:00.000Z',
      finishedAt: null,
      exercises: [],
    })
    const user = userEvent.setup()
    renderAt('/muscu/seances/pull')
    await user.click(await screen.findByRole('button', { name: 'Démarrer cette séance' }))
    expect(sessionsStart).toHaveBeenCalledWith({ workoutId: 'pull' })
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu/seance/s7'))
  })

  it('opens the Fiche exercice of each exercise', async () => {
    vi.mocked(workoutsGet).mockResolvedValue(PULL)
    renderAt('/muscu/seances/pull')
    expect(await screen.findByRole('link', { name: 'Voir Rowing barre' })).toHaveAttribute('href', '/muscu/exercices/r')
    expect(screen.getByRole('link', { name: 'Voir Tirage vertical prise large' })).toHaveAttribute(
      'href',
      '/muscu/exercices/t',
    )
  })

  it('has no start link in an inactive program', async () => {
    vi.mocked(workoutsGet).mockResolvedValue({ ...PULL, programId: 'legs', programActive: false })
    renderAt('/muscu/seances/pull')
    await screen.findByRole('button', { name: 'Enregistrer' })
    expect(screen.queryByRole('button', { name: 'Démarrer cette séance' })).toBeNull()
  })

  it('creates a séance in the program it was opened from', async () => {
    vi.mocked(workoutsCreate).mockResolvedValue(PULL)
    const user = userEvent.setup()
    renderAt('/muscu/seances/nouvelle?programme=legs')
    await user.type(await screen.findByRole('textbox', { name: 'Nom' }), 'Jambes A')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(workoutsCreate).toHaveBeenCalledWith({ name: 'Jambes A', programId: 'legs', items: [] })
  })

  it('hides the start link while a séance is in progress', async () => {
    vi.mocked(workoutsGet).mockResolvedValue(PULL)
    vi.mocked(sessionsCurrent).mockResolvedValue({
      session: { id: 's1', workoutId: 'a', workoutName: 'Push A', startedAt: '2026-10-11T08:00:00.000Z', finishedAt: null, exercises: [] },
    })
    renderAt('/muscu/seances/pull')
    await screen.findByRole('button', { name: 'Enregistrer' })
    expect(screen.queryByRole('button', { name: 'Démarrer cette séance' })).toBeNull()
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

describe('Programme', () => {
  const legs: ProgramDto = {
    id: 'legs',
    name: 'Jambes',
    position: 2,
    active: false,
    workouts: [summary('squat', 'Jambes A', 1, ['Tirage vertical prise large'])],
  }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(workoutsList).mockResolvedValue([])
    vi.mocked(programsList).mockResolvedValue([PUSH_PULL, LEGS])
    vi.mocked(sessionsCurrent).mockResolvedValue({ session: null })
    vi.mocked(programsGet).mockResolvedValue(legs)
    vi.mocked(exercisesList).mockResolvedValue([
      { ...TIRAGE, workouts: [inWorkout('squat', 'Jambes A', 'legs', false)] },
      { ...ROWING, workouts: [inWorkout('pull', 'Pull')] },
    ])
  })

  it('shows its séances (no exercises); Nouvelle séance goes into it', async () => {
    renderAt('/muscu/programmes/legs')
    expect(await screen.findByRole('link', { name: /Jambes A/ })).toHaveAttribute('href', '/muscu/seances/squat')
    expect(screen.queryByRole('heading', { name: 'Exercices' })).toBeNull()
    expect(screen.queryByText('Tirage vertical prise large')).toBeNull()
    expect(screen.getByRole('link', { name: '+ Nouvelle séance' })).toHaveAttribute(
      'href',
      '/muscu/seances/nouvelle?programme=legs',
    )
  })

  it('activates it after confirmation and goes back to Accueil', async () => {
    vi.mocked(programsActivate).mockResolvedValue({ ...legs, active: true })
    const user = userEvent.setup()
    renderAt('/muscu/programmes/legs')
    await user.click(await screen.findByRole('button', { name: 'Activer ce programme' }))
    expect(programsActivate).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('dialog', { name: 'Activer « Jambes » ?' })).getByRole('button', { name: 'Activer' }))
    expect(programsActivate).toHaveBeenCalledWith('legs')
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/muscu$/))
  })

  it('renames it', async () => {
    vi.mocked(programsUpdate).mockResolvedValue({ ...legs, name: 'Bas du corps' })
    const user = userEvent.setup()
    renderAt('/muscu/programmes/legs')
    const input = await screen.findByRole('textbox', { name: 'Nom' })
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull()
    await user.clear(input)
    await user.type(input, 'Bas du corps')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(programsUpdate).toHaveBeenCalledWith('legs', { name: 'Bas du corps' })
  })

  it('deletes an inactive program after confirmation; the active one has no delete nor Activer', async () => {
    vi.mocked(programsRemove).mockResolvedValue(undefined)
    const user = userEvent.setup()
    const { unmount } = renderAt('/muscu/programmes/legs')
    await user.click(await screen.findByRole('button', { name: 'Supprimer le programme' }))
    const confirm = screen.getByRole('dialog', { name: 'Supprimer « Jambes » et ses séances ?' })
    await user.click(within(confirm).getByRole('button', { name: 'Supprimer' }))
    expect(programsRemove).toHaveBeenCalledWith('legs')
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/muscu$/))
    unmount()

    vi.mocked(programsGet).mockResolvedValue({ ...legs, id: 'pp', name: 'Push Pull', active: true })
    renderAt('/muscu/programmes/pp')
    await screen.findByDisplayValue('Push Pull')
    expect(screen.queryByRole('button', { name: 'Supprimer le programme' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Activer ce programme' })).toBeNull()
  })
})
