import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import {
  sessionsFinish,
  sessionsGet,
  sessionsGetExercise,
  sessionsRemove,
  sessionsSaveSet,
  sessionsUpdateExercise,
} from '../../../api/generated/endpoints/sessions/sessions'
import type { ExerciseDto, SessionDto, SessionExerciseDto, SessionSetDto } from '../../../api/generated/model'
import { ToastProvider } from '../../../core/ui/Toast'
import SessionExercisePage from './SessionExercisePage'
import SessionPage from './SessionPage'
import SessionSupersetPage from './SessionSupersetPage'

vi.mock('../../../api/generated/endpoints/sessions/sessions', () => ({
  sessionsGet: vi.fn(),
  sessionsGetExercise: vi.fn(),
  sessionsSaveSet: vi.fn(),
  sessionsUpdateExercise: vi.fn(),
  sessionsFinish: vi.fn(),
  sessionsRemove: vi.fn(),
}))

const ex = (id: string, name: string): ExerciseDto => ({
  id,
  name,
  equipment: 'barbell',
  primaryMuscles: ['back'],
  secondaryMuscles: [],
  sets: 4,
  repMin: 8,
  repMax: 12,
  imageVersion: null,
  workouts: [],
})

const SESSION: SessionDto = {
  id: 's1',
  workoutId: 'w1',
  workoutName: 'Pull',
  startedAt: '2026-10-10T08:00:00.000Z',
  finishedAt: null,
  exercises: [
    { id: 'e1', exercise: ex('x1', 'Tirage vertical prise large'), status: 'done', preFatigue: 0, supersetGroup: null },
    { id: 'e2', exercise: ex('x2', 'Rowing barre'), status: 'inProgress', preFatigue: 4, supersetGroup: null },
    { id: 'e3', exercise: ex('x3', 'Curl haltères'), status: 'todo', preFatigue: 0, supersetGroup: null },
  ],
}

const set = (index: number, extra: Partial<SessionSetDto> = {}): SessionSetDto => ({
  index,
  targetWeight: 60,
  targetReps: 10,
  weight: null,
  reps: null,
  done: false,
  ...extra,
})

const ENTRY: SessionExerciseDto = {
  id: 'e2',
  sessionId: 's1',
  workoutName: 'Pull',
  exercise: ex('x2', 'Rowing barre'),
  repMin: 8,
  repMax: 12,
  easy: false,
  completed: false,
  sets: [set(0, { weight: 60, reps: 12, done: true }), set(1, { weight: 60, reps: 9, done: true }), set(2), set(3)],
  preFatigue: 0,
  fatiguedMuscles: [],
  supersetGroup: null,
  partnerId: null,
  lastTime: { date: '2026-09-28', sets: [10, 9, 9, 8].map((reps) => ({ weight: 60, reps })) },
}

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/muscu', path]}>
        <Routes>
          <Route path="/muscu" element={<Where />} />
          <Route path="/muscu/seance/:sessionId" element={<><SessionPage /><Where /></>} />
          <Route path="/muscu/seance/:sessionId/:entryId" element={<SessionExercisePage />} />
          <Route path="/muscu/seance/:sessionId/superset/:entryId" element={<SessionSupersetPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

describe('Séance — liste', () => {
  beforeEach(() => vi.resetAllMocks())

  it('shows each exercise with its status only, and the progress', async () => {
    vi.mocked(sessionsGet).mockResolvedValue(SESSION)
    renderAt('/muscu/seance/s1')
    expect(await screen.findByRole('heading', { name: 'Pull' })).toBeInTheDocument()
    expect(screen.getByText('1 / 3 faits')).toBeInTheDocument()
    const links = within(screen.getByRole('list')).getAllByRole('link')
    expect(within(links[0]).getByRole('img', { name: 'Fait' })).toBeInTheDocument()
    expect(within(links[1]).getByText('En cours')).toBeInTheDocument()
    expect(links[2]).toHaveAttribute('href', '/muscu/seance/s1/e3')
    // Pre-fatigue feeds the rules only: nothing shown.
    expect(screen.queryByRole('img', { name: 'Muscles déjà travaillés' })).toBeNull()
  })

  it('shows a superset as one card, counted once, done only when both exercises are', async () => {
    const pair = (a: 'todo' | 'inProgress' | 'done', b: 'todo' | 'inProgress' | 'done'): SessionDto => ({
      ...SESSION,
      exercises: [
        SESSION.exercises[0],
        { id: 'e2', exercise: ex('x2', 'Élévations latérales'), status: a, preFatigue: 0, supersetGroup: 'g' },
        { id: 'e3', exercise: ex('x3', 'Extension triceps poulie'), status: b, preFatigue: 0, supersetGroup: 'g' },
        { id: 'e4', exercise: ex('x4', 'Développé épaules'), status: 'todo', preFatigue: 0, supersetGroup: null },
      ],
    })
    vi.mocked(sessionsGet).mockResolvedValue(pair('done', 'inProgress'))
    const view = renderAt('/muscu/seance/s1')
    expect(await screen.findByText('1 / 3 faits')).toBeInTheDocument()
    const cards = within(screen.getByRole('list')).getAllByRole('link')
    expect(cards).toHaveLength(3)
    expect(cards[1]).toHaveAttribute('href', '/muscu/seance/s1/superset/e2')
    expect(cards[1]).toHaveTextContent('Superset')
    expect(within(cards[1]).getByText('A').parentElement).toHaveTextContent('Élévations latérales')
    expect(within(cards[1]).getByText('B').parentElement).toHaveTextContent('Extension triceps poulie')
    // One of the two is not done yet: En cours, no ✓.
    expect(within(cards[1]).getByText('En cours')).toBeInTheDocument()
    expect(within(cards[1]).queryByRole('img', { name: 'Fait' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Modifier la séance' })).toHaveAttribute('href', '/muscu/seances/w1')
    view.unmount()

    vi.mocked(sessionsGet).mockResolvedValue(pair('done', 'done'))
    renderAt('/muscu/seance/s1')
    expect(await screen.findByText('2 / 3 faits')).toBeInTheDocument()
    const done = within(screen.getByRole('list')).getAllByRole('link')[1]
    expect(within(done).getByRole('img', { name: 'Fait' })).toBeInTheDocument()
  })

  it('Terminer la séance saves it and goes back to Accueil', async () => {
    vi.mocked(sessionsGet).mockResolvedValue(SESSION)
    vi.mocked(sessionsFinish).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1')
    await user.click(await screen.findByRole('button', { name: 'Terminer la séance' }))
    expect(sessionsFinish).toHaveBeenCalledWith('s1')
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/muscu$/))
  })

  it('asks before quitting once sets were logged', async () => {
    vi.mocked(sessionsGet).mockResolvedValue(SESSION)
    vi.mocked(sessionsRemove).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1')
    await user.click(await screen.findByRole('button', { name: 'Quitter la séance' }))
    const confirm = screen.getByRole('dialog', { name: 'Abandonner la séance ?' })
    await user.click(within(confirm).getByRole('button', { name: 'Abandonner' }))
    expect(sessionsRemove).toHaveBeenCalledWith('s1')
  })
})

describe('Exercice en cours', () => {
  beforeEach(() => vi.resetAllMocks())

  it('shows Objectif, done sets (under target in the "over" colour) and last time', async () => {
    vi.mocked(sessionsGetExercise).mockResolvedValue(ENTRY)
    renderAt('/muscu/seance/s1/e2')
    expect(await screen.findByRole('heading', { name: 'Rowing barre' })).toBeInTheDocument()
    expect(screen.getByText('4 × 8–12')).toBeInTheDocument()
    expect(screen.getAllByText('60 × 10')).toHaveLength(4)
    expect(screen.getByText('12').className).toMatch(/met/)
    expect(screen.getByText('9').className).toMatch(/under/)
    expect(screen.getByRole('textbox', { name: 'Charge série 3' })).toHaveAttribute('placeholder', '60')
    expect(screen.getByRole('textbox', { name: 'Répétitions série 3' })).toHaveAttribute('placeholder', '10')
    expect(screen.getByText('Dernière fois · lun 28 sept')).toBeInTheDocument()
    expect(screen.getByText('60 kg × 10 · 9 · 9 · 8')).toBeInTheDocument()
  })

  it('✓ on an empty row records the target; typed values are sent as typed', async () => {
    vi.mocked(sessionsGetExercise).mockResolvedValue(ENTRY)
    vi.mocked(sessionsSaveSet).mockResolvedValue({ ...ENTRY, sets: ENTRY.sets.map((s) => (s.index === 2 ? { ...s, weight: 60, reps: 10, done: true } : s)) })
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1/e2')
    await user.click(await screen.findByRole('button', { name: 'Valider la série 3' }))
    expect(sessionsSaveSet).toHaveBeenCalledWith('s1', 'e2', 2, { weight: null, reps: null, done: true })
    expect(await screen.findByRole('button', { name: 'Série 3 faite, modifier' })).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Charge série 4' }), '57,5')
    await user.type(screen.getByRole('textbox', { name: 'Répétitions série 4' }), '11')
    await user.click(screen.getByRole('button', { name: 'Valider la série 4' }))
    expect(sessionsSaveSet).toHaveBeenLastCalledWith('s1', 'e2', 3, { weight: 57.5, reps: 11, done: true })
  })

  it('shows no "déjà travaillé" tag, even when pre-fatigued', async () => {
    vi.mocked(sessionsGetExercise).mockResolvedValue({ ...ENTRY, preFatigue: 4, fatiguedMuscles: ['back'] })
    renderAt('/muscu/seance/s1/e2')
    await screen.findByRole('heading', { name: 'Rowing barre' })
    expect(screen.queryByText(/déjà travaillé/)).toBeNull()
  })

  it('first time: no Objectif, no placeholder, ✓ needs both values', async () => {
    const first = { ...ENTRY, sets: [set(0, { targetWeight: null, targetReps: null })], lastTime: null }
    vi.mocked(sessionsGetExercise).mockResolvedValue(first)
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1/e2')
    const validate = await screen.findByRole('button', { name: 'Valider la série 1' })
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Charge série 1' })).not.toHaveAttribute('placeholder')
    expect(validate).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Charge série 1' }), '40')
    expect(validate).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Répétitions série 1' }), '10')
    expect(validate).toBeEnabled()
    // Off the 0.5 kg grid.
    await user.clear(screen.getByRole('textbox', { name: 'Charge série 1' }))
    await user.type(screen.getByRole('textbox', { name: 'Charge série 1' }), '40,3')
    expect(validate).toBeDisabled()
  })

  it('only the next set has inputs; later ones are locked with their target', async () => {
    vi.mocked(sessionsGetExercise).mockResolvedValue(ENTRY)
    renderAt('/muscu/seance/s1/e2')
    expect(await screen.findByRole('textbox', { name: 'Charge série 3' })).toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    expect(screen.queryByRole('textbox', { name: 'Charge série 4' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Valider la série 4' })).toBeDisabled()
  })

  it('reopening an earlier set makes it the one to edit; later sets to do stay locked', async () => {
    const reopened = {
      ...ENTRY,
      sets: ENTRY.sets.map((s) => (s.index === 0 ? { ...s, done: false } : s)),
    }
    vi.mocked(sessionsGetExercise).mockResolvedValue(ENTRY)
    vi.mocked(sessionsSaveSet).mockResolvedValue(reopened)
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1/e2')
    await user.click(await screen.findByRole('button', { name: 'Série 1 faite, modifier' }))
    expect(sessionsSaveSet).toHaveBeenCalledWith('s1', 'e2', 0, { weight: 60, reps: 12, done: false })
    // Set 1 is editable again (with its values), set 2 stays done, sets 3 and 4 are locked.
    expect(await screen.findByRole('textbox', { name: 'Charge série 1' })).toHaveValue('60')
    expect(screen.getByRole('button', { name: 'Série 2 faite, modifier' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Charge série 3' })).toBeNull()
  })

  it('Terminé needs every set done; Facile toggles', async () => {
    const all = { ...ENTRY, sets: ENTRY.sets.map((s) => ({ ...s, weight: 60, reps: 10, done: true })) }
    vi.mocked(sessionsGetExercise).mockResolvedValue(all)
    vi.mocked(sessionsUpdateExercise).mockResolvedValue({ ...all, easy: true })
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1/e2')

    // Off by default; no OK / Dur.
    const easy = 'Facile, monter la charge la prochaine fois'
    await user.click(await screen.findByRole('button', { name: easy, pressed: false }))
    expect(sessionsUpdateExercise).toHaveBeenCalledWith('s1', 'e2', { easy: true })
    expect(await screen.findByRole('button', { name: easy, pressed: true })).toHaveTextContent('Facile')
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Dur' })).toBeNull()

    // Tapping it again clears it.
    vi.mocked(sessionsUpdateExercise).mockResolvedValue(all)
    await user.click(screen.getByRole('button', { name: easy, pressed: true }))
    expect(sessionsUpdateExercise).toHaveBeenLastCalledWith('s1', 'e2', { easy: false })
    expect(await screen.findByRole('button', { name: easy, pressed: false })).toBeInTheDocument()
    vi.mocked(sessionsUpdateExercise).mockResolvedValue({ ...all, completed: true })

    // Everything done: no early stop, Terminé completes.
    expect(screen.queryByRole('button', { name: 'Terminer l’exercice plus tôt' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Terminé' }))
    expect(sessionsUpdateExercise).toHaveBeenLastCalledWith('s1', 'e2', { completed: true })
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu'))
  })

  it('stops early after a confirmation; Terminé stays disabled until all sets are done', async () => {
    vi.mocked(sessionsGetExercise).mockResolvedValue(ENTRY)
    vi.mocked(sessionsUpdateExercise).mockResolvedValue({ ...ENTRY, completed: true })
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1/e2')
    expect(await screen.findByRole('button', { name: 'Terminé' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Terminer l’exercice plus tôt' }))
    const confirm = screen.getByRole('dialog', { name: 'Terminer avec 2 / 4 séries ?' })
    await user.click(within(confirm).getByRole('button', { name: 'Terminer' }))
    expect(sessionsUpdateExercise).toHaveBeenCalledWith('s1', 'e2', { completed: true })
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu'))
  })

  it('no early stop before the first set', async () => {
    vi.mocked(sessionsGetExercise).mockResolvedValue({ ...ENTRY, sets: [0, 1, 2, 3].map((i) => set(i)) })
    renderAt('/muscu/seance/s1/e2')
    expect(await screen.findByRole('button', { name: 'Terminé' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Terminer l’exercice plus tôt' })).toBeNull()
  })
})

describe('Exercice en cours — assistance (bodyweight exercises)', () => {
  const TRACTIONS = { ...ex('x9', 'Tractions'), equipment: 'bodyweight' as const }
  const at = (weight: number, reps: number[]) => reps.map((r) => ({ weight, reps: r }))
  // Aide 20 × 9·9·8·8 last time → targets Aide 20 × 10·10·9·9, stored −20.
  const ASSISTED: SessionExerciseDto = {
    ...ENTRY,
    exercise: TRACTIONS,
    sets: [10, 10, 9, 9].map((targetReps, i) => set(i, { targetWeight: -20, targetReps })),
    lastTime: { date: '2026-10-08', sets: at(-20, [9, 9, 8, 8]) },
  }
  const withDone = (entry: SessionExerciseDto, done: Record<number, Partial<SessionSetDto>>): SessionExerciseDto => ({
    ...entry,
    sets: entry.sets.map((s) => (done[s.index] ? { ...s, ...done[s.index], done: true } : s)),
  })
  const toggle = () => screen.getByRole('group', { name: 'Type de charge' })
  const pressed = (name: string) => within(toggle()).getByRole('button', { name }).getAttribute('aria-pressed')

  beforeEach(() => vi.resetAllMocks())

  it('shows the Lest | Aide control only for bodyweight exercises', async () => {
    vi.mocked(sessionsGetExercise).mockResolvedValue(ENTRY)
    const view = renderAt('/muscu/seance/s1/e2')
    await screen.findByRole('heading', { name: 'Rowing barre' })
    expect(screen.queryByRole('group', { name: 'Type de charge' })).toBeNull()
    expect(screen.getByText('kg')).toBeInTheDocument()
    view.unmount()

    vi.mocked(sessionsGetExercise).mockResolvedValue(ASSISTED)
    renderAt('/muscu/seance/s1/e2')
    await screen.findByRole('heading', { name: 'Tractions' })
    expect(within(toggle()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Lest', 'Aide'])
  })

  it('negative targets open in Aide: every number is shown positive, under "Aide kg"', async () => {
    vi.mocked(sessionsGetExercise).mockResolvedValue(withDone(ASSISTED, { 0: { weight: -20, reps: 10 } }))
    renderAt('/muscu/seance/s1/e2')
    await screen.findByRole('heading', { name: 'Tractions' })
    expect(pressed('Aide')).toBe('true')
    expect(pressed('Lest')).toBe('false')
    expect(screen.getByText('Aide kg')).toBeInTheDocument()
    expect(screen.queryByText('kg')).toBeNull()
    expect(screen.getAllByText('20 × 10')).toHaveLength(2)
    expect(screen.getAllByText('20 × 9')).toHaveLength(2)
    // Done set, placeholder and locked rows: 20, never −20.
    expect(screen.getByRole('textbox', { name: 'Aide série 2' })).toHaveAttribute('placeholder', '20')
    expect(screen.queryByRole('textbox', { name: 'Charge série 2' })).toBeNull()
    expect(document.body).not.toHaveTextContent(/-20|−20/)
    expect(screen.getByText('Aide 20 kg × 9 · 9 · 8 · 8')).toBeInTheDocument()
  })

  it('Aide stores negatives: a typed 15 is saved as −15, ✓ on an empty row records the target', async () => {
    vi.mocked(sessionsGetExercise).mockResolvedValue(ASSISTED)
    vi.mocked(sessionsSaveSet).mockResolvedValue(withDone(ASSISTED, { 0: { weight: -15, reps: 10 } }))
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1/e2')
    await user.type(await screen.findByRole('textbox', { name: 'Aide série 1' }), '15')
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }))
    expect(sessionsSaveSet).toHaveBeenCalledWith('s1', 'e2', 0, { weight: -15, reps: null, done: true })
    // Shown positive once done.
    expect(await screen.findByRole('button', { name: 'Série 1 faite, modifier' })).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Valider la série 2' }))
    expect(sessionsSaveSet).toHaveBeenLastCalledWith('s1', 'e2', 1, { weight: null, reps: null, done: true })

    // Reopening sends the stored (negative) value back.
    await user.click(screen.getByRole('button', { name: 'Série 1 faite, modifier' }))
    expect(sessionsSaveSet).toHaveBeenLastCalledWith('s1', 'e2', 0, { weight: -15, reps: 10, done: false })
  })

  it('selecting Aide mid-session flips the sets already logged: 10 → −10', async () => {
    const first = { ...ASSISTED, sets: [0, 1, 2, 3].map((i) => set(i, { targetWeight: null, targetReps: null })), lastTime: null }
    const logged = withDone(first, { 0: { weight: 10, reps: 8 }, 1: { weight: 10, reps: 7 } })
    const flipped = withDone(first, { 0: { weight: -10, reps: 8 }, 1: { weight: -10, reps: 7 } })
    vi.mocked(sessionsGetExercise).mockResolvedValue(logged)
    vi.mocked(sessionsSaveSet).mockResolvedValue(flipped)
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1/e2')
    await screen.findByRole('heading', { name: 'Tractions' })
    // Logged with added load: Lest.
    expect(pressed('Lest')).toBe('true')

    await user.click(within(toggle()).getByRole('button', { name: 'Aide' }))
    await waitFor(() => expect(sessionsSaveSet).toHaveBeenCalledTimes(2))
    expect(sessionsSaveSet).toHaveBeenNthCalledWith(1, 's1', 'e2', 0, { weight: -10, reps: 8, done: true })
    expect(sessionsSaveSet).toHaveBeenNthCalledWith(2, 's1', 'e2', 1, { weight: -10, reps: 7, done: true })
    await waitFor(() => expect(pressed('Aide')).toBe('true'))
    expect(screen.getByText('Aide kg')).toBeInTheDocument()

    // Back to Lest: positive again; the next set is saved as typed.
    vi.mocked(sessionsSaveSet).mockResolvedValue(logged)
    await user.click(within(toggle()).getByRole('button', { name: 'Lest' }))
    await waitFor(() => expect(sessionsSaveSet).toHaveBeenCalledTimes(4))
    expect(sessionsSaveSet).toHaveBeenLastCalledWith('s1', 'e2', 1, { weight: 10, reps: 7, done: true })
    await user.type(await screen.findByRole('textbox', { name: 'Charge série 3' }), '10')
    await user.type(screen.getByRole('textbox', { name: 'Répétitions série 3' }), '6')
    await user.click(screen.getByRole('button', { name: 'Valider la série 3' }))
    expect(sessionsSaveSet).toHaveBeenLastCalledWith('s1', 'e2', 2, { weight: 10, reps: 6, done: true })
  })

  it('switching before any set is logged saves nothing; targets of the other mode are not targets', async () => {
    vi.mocked(sessionsGetExercise).mockResolvedValue(ASSISTED)
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1/e2')
    await screen.findByRole('heading', { name: 'Tractions' })
    await user.click(within(toggle()).getByRole('button', { name: 'Lest' }))
    expect(pressed('Lest')).toBe('true')
    expect(sessionsSaveSet).not.toHaveBeenCalled()
    // Help of 20 kg is not a target of 20 kg of added load.
    expect(screen.queryByText('20 × 10')).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Charge série 1' })).not.toHaveAttribute('placeholder')
    expect(screen.getByRole('button', { name: 'Valider la série 1' })).toBeDisabled()
  })

  it('opens in Lest at 0 kg once the help has reached 0', async () => {
    vi.mocked(sessionsGetExercise).mockResolvedValue({
      ...ASSISTED,
      sets: [0, 1, 2, 3].map((i) => set(i, { targetWeight: 0, targetReps: 8 })),
      lastTime: { date: '2026-10-08', sets: at(-4.5, [12, 12, 11, 10]) },
    })
    vi.mocked(sessionsSaveSet).mockResolvedValue(ASSISTED)
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1/e2')
    await screen.findByRole('heading', { name: 'Tractions' })
    expect(pressed('Lest')).toBe('true')
    expect(screen.getByText('kg')).toBeInTheDocument()
    expect(screen.getAllByText('0 × 8')).toHaveLength(4)
    expect(screen.getByRole('textbox', { name: 'Charge série 1' })).toHaveAttribute('placeholder', '0')
    expect(screen.getByText('Aide 4,5 kg × 12 · 12 · 11 · 10')).toBeInTheDocument()
    // A typed load is stored as typed.
    await user.type(screen.getByRole('textbox', { name: 'Charge série 1' }), '2,5')
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }))
    expect(sessionsSaveSet).toHaveBeenCalledWith('s1', 'e2', 0, { weight: 2.5, reps: null, done: true })
  })
})

describe('Superset en cours', () => {
  const done = { weight: 10, reps: 14, done: true }
  // A: 4 sets (A1 done), B: 3 sets (none done) → A1 B1 A2 B2 A3 B3 A4, B1 is next.
  const A: SessionExerciseDto = {
    ...ENTRY,
    id: 'ea',
    workoutName: 'Push B',
    exercise: ex('xa', 'Élévations latérales'),
    repMin: 12,
    repMax: 15,
    sets: [set(0, { targetWeight: 10, targetReps: 14, ...done }), ...[1, 2, 3].map((i) => set(i, { targetWeight: 10, targetReps: 13 }))],
    supersetGroup: 'g',
    partnerId: 'eb',
    lastTime: { date: '2026-09-28', sets: [13, 13, 12, 11].map((reps) => ({ weight: 10, reps })) },
  }
  const B: SessionExerciseDto = {
    ...ENTRY,
    id: 'eb',
    workoutName: 'Push B',
    exercise: ex('xb', 'Extension triceps poulie'),
    repMin: 10,
    repMax: 12,
    sets: [0, 1, 2].map((i) => set(i, { targetWeight: 25, targetReps: 11 })),
    supersetGroup: 'g',
    partnerId: 'ea',
    lastTime: { date: '2026-09-21', sets: [11, 10, 10].map((reps) => ({ weight: 25, reps })) },
  }
  const byId = (a: SessionExerciseDto, b: SessionExerciseDto) => (_s: string, id: string) => Promise.resolve(id === 'ea' ? a : b)
  const allDone = (e: SessionExerciseDto) => ({ ...e, sets: e.sets.map((s) => ({ ...s, weight: 10, reps: 12, done: true })) })

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(sessionsGetExercise).mockImplementation(byId(A, B))
  })

  it('shows both exercises and their sets alternately, the rest of the longer one last', async () => {
    renderAt('/muscu/seance/s1/superset/ea')
    expect(await screen.findByRole('heading', { name: 'Push B · Superset' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Élévations latérales/ })).toHaveAttribute('href', '/muscu/exercices/xa')
    expect(screen.getByRole('link', { name: /Extension triceps poulie/ })).toHaveTextContent('3 × 10–12')

    const order = screen
      .getAllByRole('button', { name: /^(Valider [AB]\d|[AB]\d faite, modifier)$/ })
      .map((b) => b.getAttribute('aria-label')!.replace(/Valider | faite, modifier/g, ''))
    expect(order).toEqual(['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4'])

    // Only the next set of the superset has inputs, with its target as placeholder.
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    expect(screen.getByRole('textbox', { name: 'Charge B1' })).toHaveAttribute('placeholder', '25')
    expect(screen.getByRole('textbox', { name: 'Répétitions B1' })).toHaveAttribute('placeholder', '11')
    expect(screen.getByRole('button', { name: 'Valider A2' })).toBeDisabled()

    expect(screen.getByText('Dernière fois · lun 28 sept')).toBeInTheDocument()
    expect(screen.getByText('10 kg × 13 · 13 · 12 · 11')).toBeInTheDocument()
    expect(screen.getByText('25 kg × 11 · 10 · 10')).toBeInTheDocument()
  })

  it('✓ saves the set of its own exercise and reads the other again while it is not started', async () => {
    const savedB = { ...B, sets: B.sets.map((s) => (s.index === 0 ? { ...s, weight: 25, reps: 11, done: true } : s)) }
    vi.mocked(sessionsSaveSet).mockResolvedValue(savedB)
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1/superset/ea')

    await user.click(await screen.findByRole('button', { name: 'Valider B1' }))
    expect(sessionsSaveSet).toHaveBeenCalledWith('s1', 'eb', 0, { weight: null, reps: null, done: true })
    // A already has a validated set: its targets are frozen, no need to read it again.
    expect(sessionsGetExercise).toHaveBeenCalledTimes(2)
    expect(await screen.findByRole('textbox', { name: 'Charge A2' })).toHaveAttribute('placeholder', '10')

    vi.mocked(sessionsSaveSet).mockResolvedValue({ ...A, sets: A.sets.map((s) => (s.index === 0 ? set(0) : s)) })
    await user.click(screen.getByRole('button', { name: 'A1 faite, modifier' }))
    expect(sessionsSaveSet).toHaveBeenLastCalledWith('s1', 'ea', 0, { weight: 10, reps: 14, done: false })
  })

  it('has one Facile toggle per exercise, with its badge', async () => {
    vi.mocked(sessionsUpdateExercise).mockResolvedValue({ ...B, easy: true })
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1/superset/ea')

    const toggle = await screen.findByRole('button', { name: 'Extension triceps poulie facile', pressed: false })
    expect(toggle).toHaveTextContent('BFacile')
    await user.click(toggle)
    expect(sessionsUpdateExercise).toHaveBeenCalledWith('s1', 'eb', { easy: true })
    expect(await screen.findByRole('button', { name: 'Extension triceps poulie facile', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Élévations latérales facile', pressed: false })).toHaveTextContent('AFacile')
  })

  it('Terminé completes both exercises once every set is done', async () => {
    vi.mocked(sessionsGetExercise).mockImplementation(byId(allDone(A), allDone(B)))
    vi.mocked(sessionsUpdateExercise).mockImplementation((_s, id) => Promise.resolve({ ...allDone(id === 'ea' ? A : B), completed: true }))
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1/superset/ea')

    await user.click(await screen.findByRole('button', { name: 'Terminé' }))
    expect(sessionsUpdateExercise).toHaveBeenCalledWith('s1', 'ea', { completed: true })
    expect(sessionsUpdateExercise).toHaveBeenCalledWith('s1', 'eb', { completed: true })
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu'))
  })

  it('stops early after a confirmation: only the exercise with a validated set is completed', async () => {
    vi.mocked(sessionsUpdateExercise).mockResolvedValue({ ...A, completed: true })
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1/superset/ea')
    expect(await screen.findByRole('button', { name: 'Terminé' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Terminer le superset plus tôt' }))
    const confirm = screen.getByRole('dialog', { name: 'Terminer avec 1 / 7 séries ?' })
    await user.click(within(confirm).getByRole('button', { name: 'Terminer' }))
    expect(sessionsUpdateExercise).toHaveBeenCalledTimes(1)
    expect(sessionsUpdateExercise).toHaveBeenCalledWith('s1', 'ea', { completed: true })
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu'))
  })

  it('a bodyweight exercise of the pair has its own Lest | Aide control; its help is stored negative', async () => {
    const pullUps: SessionExerciseDto = {
      ...A,
      exercise: { ...ex('xa', 'Tractions'), equipment: 'bodyweight' },
      sets: [0, 1, 2, 3].map((i) => set(i, { targetWeight: -20, targetReps: 9 })),
      lastTime: { date: '2026-09-28', sets: [9, 9, 8, 8].map((reps) => ({ weight: -20, reps })) },
    }
    vi.mocked(sessionsGetExercise).mockImplementation(byId(pullUps, B))
    vi.mocked(sessionsSaveSet).mockResolvedValue({
      ...pullUps,
      sets: pullUps.sets.map((s) => (s.index === 0 ? { ...s, weight: -15, reps: 9, done: true } : s)),
    })
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1/superset/ea')

    const group = await screen.findByRole('group', { name: 'Type de charge Tractions' })
    expect(within(group).getByRole('button', { name: 'Aide' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('group', { name: 'Type de charge Extension triceps poulie' })).toBeNull()
    // One column for both exercises: "kg" while one of them is not help.
    expect(screen.getByText('kg')).toBeInTheDocument()
    expect(screen.getByText('Aide 20 kg × 9 · 9 · 8 · 8')).toBeInTheDocument()

    const help = screen.getByRole('textbox', { name: 'Aide A1' })
    expect(help).toHaveAttribute('placeholder', '20')
    await user.type(help, '15')
    await user.click(screen.getByRole('button', { name: 'Valider A1' }))
    expect(sessionsSaveSet).toHaveBeenCalledWith('s1', 'ea', 0, { weight: -15, reps: null, done: true })
    // The other exercise is untouched: its weight is sent as typed.
    expect(await screen.findByRole('textbox', { name: 'Charge B1' })).toHaveAttribute('placeholder', '25')

    // Switching to Lest flips the set logged for Tractions only.
    await user.click(within(screen.getByRole('group', { name: 'Type de charge Tractions' })).getByRole('button', { name: 'Lest' }))
    await waitFor(() => expect(sessionsSaveSet).toHaveBeenLastCalledWith('s1', 'ea', 0, { weight: 15, reps: 9, done: true }))
  })

  it('opens the usual screen for an exercise that is not in a superset', async () => {
    vi.mocked(sessionsGetExercise).mockResolvedValue(ENTRY)
    renderAt('/muscu/seance/s1/superset/e2')
    expect(await screen.findByRole('heading', { name: 'Rowing barre' })).toBeInTheDocument()
  })
})
