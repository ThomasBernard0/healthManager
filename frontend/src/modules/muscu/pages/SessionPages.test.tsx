import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { exercisesImage } from '../../../api/generated/endpoints/exercises/exercises'
import {
  sessionsBundle,
  sessionsFinish,
  sessionsRemove,
} from '../../../api/generated/endpoints/sessions/sessions'
import type { ExerciseDto, SessionSetDto } from '../../../api/generated/model'
import { ToastProvider } from '../../../core/ui/Toast'
import { finishBody, type LocalEntry, type LocalSession } from '../offline/localSession'
import { clearLocalSession, readLocalSession, saveLocalSession } from '../offline/store'
import SessionExercisePage from './SessionExercisePage'
import SessionPage from './SessionPage'
import SessionSupersetPage from './SessionSupersetPage'

vi.mock('../../../api/generated/endpoints/sessions/sessions', () => ({
  sessionsBundle: vi.fn(),
  sessionsFinish: vi.fn(),
  sessionsRemove: vi.fn(),
}))
vi.mock('../../../api/generated/endpoints/exercises/exercises', () => ({ exercisesImage: vi.fn() }))

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

const doneAt = (index: number) => `2026-10-10T08:${String(10 + index).padStart(2, '0')}:00.000Z`

const set = (index: number, extra: Partial<SessionSetDto> = {}): SessionSetDto => ({
  index,
  targetWeight: 60,
  targetReps: 10,
  weight: null,
  reps: null,
  done: false,
  doneAt: null,
  ...extra,
  ...(extra.done ? { doneAt: doneAt(index) } : {}),
})

type Spec = Partial<LocalEntry> & {
  id: string
  exercise: ExerciseDto
  /** "Dernière fois" (the last finished session). */
  lastTime?: { date: string; sets: { weight: number; reps: number }[] } | null
}

/** An exercise of the local copy, already started (its targets are the ones given: frozen). */
function entry({ lastTime, ...spec }: Spec): LocalEntry {
  return {
    repMin: 8,
    repMax: 12,
    supersetGroup: null,
    easy: false,
    completed: false,
    sets: [0, 1, 2, 3].map((i) => set(i)),
    knownWeights: [],
    step: 5,
    preFatigue: 0,
    ...spec,
    history: lastTime
      ? [
          {
            date: lastTime.date,
            sets: lastTime.sets.map((s) => ({ ...s, targetWeight: null, targetReps: null })),
            easy: false,
            preFatigue: 0,
            complete: true,
          },
        ]
      : lastTime === null
        ? []
        : (spec.history ?? []),
  }
}

const session = (...exercises: LocalEntry[]): LocalSession => ({
  id: 's1',
  workoutId: 'w1',
  workoutName: 'Pull',
  startedAt: '2026-10-10T08:00:00.000Z',
  exercises,
})

const ROWING = entry({
  id: 'e2',
  exercise: ex('x2', 'Rowing barre'),
  sets: [set(0, { weight: 60, reps: 12, done: true }), set(1, { weight: 60, reps: 9, done: true }), set(2), set(3)],
  lastTime: { date: '2026-09-28', sets: [10, 9, 9, 8].map((reps) => ({ weight: 60, reps })) },
})

const LIST = session(
  entry({
    id: 'e1',
    exercise: ex('x1', 'Tirage vertical prise large'),
    completed: true,
    sets: [0, 1, 2, 3].map((i) => set(i, { weight: 60, reps: 10, done: true })),
  }),
  ROWING,
  entry({ id: 'e3', exercise: ex('x3', 'Curl haltères'), preFatigue: null }),
)

/** The local copy as stored now. */
const stored = () => readLocalSession()
const storedEntry = async (id: string) => (await stored())!.exercises.find((e) => e.id === id)!

let online = true

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

async function renderAt(path: string, local: LocalSession | null = LIST) {
  if (local) await saveLocalSession(local)
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

const networkError = () => new AxiosError('Network Error', 'ERR_NETWORK')

beforeEach(async () => {
  vi.resetAllMocks()
  online = true
  vi.spyOn(window.navigator, 'onLine', 'get').mockImplementation(() => online)
  await clearLocalSession()
})
afterEach(() => vi.restoreAllMocks())

/** During a session nothing goes to the API. */
function expectNoApiCall() {
  expect(sessionsFinish).not.toHaveBeenCalled()
  expect(sessionsRemove).not.toHaveBeenCalled()
  expect(sessionsBundle).not.toHaveBeenCalled()
  expect(exercisesImage).not.toHaveBeenCalled()
}

describe('Séance — liste', () => {
  it('shows each exercise with its status only, and the progress; no pencil', async () => {
    await renderAt('/muscu/seance/s1')
    expect(await screen.findByRole('heading', { name: 'Pull' })).toBeInTheDocument()
    expect(screen.getByText('1 / 3 faits')).toBeInTheDocument()
    const links = within(screen.getByRole('list')).getAllByRole('link')
    expect(within(links[0]).getByRole('img', { name: 'Fait' })).toBeInTheDocument()
    expect(within(links[1]).getByText('En cours')).toBeInTheDocument()
    expect(links[2]).toHaveAttribute('href', '/muscu/seance/s1/e3')
    expect(screen.queryByRole('link', { name: 'Modifier la séance' })).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.queryByRole('img', { name: 'Pas de connexion' })).toBeNull()
    expectNoApiCall()
  })

  it('shows a superset as one card, counted once, done only when both exercises are', async () => {
    const pair = (aDone: boolean, bDone: boolean) =>
      session(
        LIST.exercises[0],
        entry({ id: 'e2', exercise: ex('x2', 'Élévations latérales'), supersetGroup: 'g', completed: aDone, sets: [set(0, { weight: 10, reps: 12, done: true })] }),
        entry({ id: 'e3', exercise: ex('x3', 'Extension triceps poulie'), supersetGroup: 'g', completed: bDone, sets: [set(0, { weight: 25, reps: 10, done: true })] }),
        entry({ id: 'e4', exercise: ex('x4', 'Développé épaules') }),
      )
    const view = await renderAt('/muscu/seance/s1', pair(true, false))
    expect(await screen.findByText('1 / 3 faits')).toBeInTheDocument()
    const cards = within(screen.getByRole('list')).getAllByRole('link')
    expect(cards).toHaveLength(3)
    expect(cards[1]).toHaveAttribute('href', '/muscu/seance/s1/superset/e2')
    expect(cards[1]).toHaveTextContent('Superset')
    expect(within(cards[1]).getByText('A').parentElement).toHaveTextContent('Élévations latérales')
    expect(within(cards[1]).getByText('B').parentElement).toHaveTextContent('Extension triceps poulie')
    expect(within(cards[1]).getByText('En cours')).toBeInTheDocument()
    expect(within(cards[1]).queryByRole('img', { name: 'Fait' })).toBeNull()
    view.unmount()

    await renderAt('/muscu/seance/s1', pair(true, true))
    expect(await screen.findByText('2 / 3 faits')).toBeInTheDocument()
    const done = within(screen.getByRole('list')).getAllByRole('link')[1]
    expect(within(done).getByRole('img', { name: 'Fait' })).toBeInTheDocument()
  })

  it('Terminer la séance sends the whole session once, clears the local copy, goes back to Accueil', async () => {
    vi.mocked(sessionsFinish).mockResolvedValue(undefined)
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1')
    await user.click(await screen.findByRole('button', { name: 'Terminer la séance' }))
    expect(sessionsFinish).toHaveBeenCalledTimes(1)
    expect(sessionsFinish).toHaveBeenCalledWith('s1', finishBody(LIST))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/muscu$/))
    expect(await stored()).toBeNull()
  })

  it('Terminer with no network (weak signal): "Pas de connexion", everything kept', async () => {
    vi.mocked(sessionsFinish).mockRejectedValue(networkError())
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1')
    await user.click(await screen.findByRole('button', { name: 'Terminer la séance' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Pas de connexion')
    expect(screen.getByTestId('where')).toHaveTextContent('/muscu/seance/s1')
    expect(await stored()).toEqual(LIST)
  })

  it('Terminer on a session the server no longer has: the local copy is dropped too', async () => {
    vi.mocked(sessionsFinish).mockRejectedValue(new AxiosError('Not Found', 'ERR_BAD_REQUEST', undefined, undefined, { status: 404 } as never))
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1')
    await user.click(await screen.findByRole('button', { name: 'Terminer la séance' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/muscu$/))
    expect(await stored()).toBeNull()
  })

  it('asks before quitting once sets were logged; the local copy goes after the server agreed', async () => {
    vi.mocked(sessionsRemove).mockResolvedValue(undefined)
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1')
    await user.click(await screen.findByRole('button', { name: 'Quitter la séance' }))
    const confirm = screen.getByRole('dialog', { name: 'Abandonner la séance ?' })
    await user.click(within(confirm).getByRole('button', { name: 'Abandonner' }))
    expect(sessionsRemove).toHaveBeenCalledWith('s1')
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/muscu$/))
    expect(await stored()).toBeNull()
  })

  it('offline: crossed cloud, close and Terminer disabled', async () => {
    online = false
    await renderAt('/muscu/seance/s1')
    expect(await screen.findByRole('img', { name: 'Pas de connexion' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitter la séance, connexion requise' })).toBeDisabled()
    const finish = screen.getByRole('button', { name: 'Terminer la séance, connexion requise' })
    expect(finish).toBeDisabled()
    expect(finish).toHaveTextContent('Terminer la séance')
    // Everything else works.
    expect(within(screen.getByRole('list')).getAllByRole('link')).toHaveLength(3)
  })

  it('back online: Terminer is enabled again', async () => {
    online = false
    await renderAt('/muscu/seance/s1')
    await screen.findByRole('img', { name: 'Pas de connexion' })
    online = true
    window.dispatchEvent(new Event('online'))
    expect(await screen.findByRole('button', { name: 'Terminer la séance' })).toBeEnabled()
    expect(screen.queryByRole('img', { name: 'Pas de connexion' })).toBeNull()
  })

  it('no local copy on this device: loads the bundle of the session in progress', async () => {
    vi.mocked(sessionsBundle).mockResolvedValue(LIST)
    await renderAt('/muscu/seance/s1', null)
    expect(await screen.findByRole('heading', { name: 'Pull' })).toBeInTheDocument()
    expect(sessionsBundle).toHaveBeenCalledWith('s1')
    expect((await stored())!.id).toBe('s1')
  })

  it('no local copy and no network: "Pas de connexion"', async () => {
    vi.mocked(sessionsBundle).mockRejectedValue(networkError())
    await renderAt('/muscu/seance/s1', null)
    expect(await screen.findByRole('alert')).toHaveTextContent('Pas de connexion')
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })
})

describe('Exercice en cours', () => {
  it('shows Objectif, done sets (under target in the "over" colour) and last time; not a link', async () => {
    await renderAt('/muscu/seance/s1/e2')
    expect(await screen.findByRole('heading', { name: 'Rowing barre' })).toBeInTheDocument()
    expect(screen.getByText('4 × 8–12')).toBeInTheDocument()
    expect(screen.getAllByText('60 × 10')).toHaveLength(4)
    expect(screen.getByText('12').className).toMatch(/met/)
    expect(screen.getByText('9').className).toMatch(/under/)
    expect(screen.getByRole('textbox', { name: 'Charge série 3' })).toHaveAttribute('placeholder', '60')
    expect(screen.getByRole('textbox', { name: 'Répétitions série 3' })).toHaveAttribute('placeholder', '10')
    expect(screen.getByText('Dernière fois · lun 28 sept')).toBeInTheDocument()
    expect(screen.getByText('60 kg × 10 · 9 · 9 · 8')).toBeInTheDocument()
    // No Fiche exercice during a session.
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('offline: ✓ on an empty row records the target; typed values are kept as typed', async () => {
    online = false
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1/e2')
    await user.click(await screen.findByRole('button', { name: 'Valider la série 3' }))
    expect(await screen.findByRole('button', { name: 'Série 3 faite, modifier' })).toBeInTheDocument()
    expect((await storedEntry('e2')).sets[2]).toMatchObject({ weight: 60, reps: 10, done: true })

    await user.type(screen.getByRole('textbox', { name: 'Charge série 4' }), '57,5')
    await user.type(screen.getByRole('textbox', { name: 'Répétitions série 4' }), '11')
    await user.click(screen.getByRole('button', { name: 'Valider la série 4' }))
    await waitFor(async () => expect((await storedEntry('e2')).sets[3]).toMatchObject({ weight: 57.5, reps: 11, done: true }))
    expect((await storedEntry('e2')).sets[3].doneAt).not.toBeNull()
    expectNoApiCall()
  })

  it('targets of an exercise not started yet are computed on the phone from its history', async () => {
    const curl = entry({
      id: 'e3',
      exercise: ex('x3', 'Curl haltères'),
      preFatigue: null,
      sets: [0, 1, 2, 3].map((i) => set(i, { targetWeight: null, targetReps: null })),
      knownWeights: [12],
      lastTime: { date: '2026-10-01', sets: [10, 10, 9, 9].map((reps) => ({ weight: 12, reps })) },
    })
    await renderAt('/muscu/seance/s1/e3', session(curl))
    await screen.findByRole('heading', { name: 'Curl haltères' })
    // 38 reps (4 × 8–12): progress, +1 rep each.
    expect(screen.getAllByText('12 × 11')).toHaveLength(2)
    expect(screen.getAllByText('12 × 10')).toHaveLength(2)
  })

  it('first time: no Objectif, no placeholder, ✓ needs both values', async () => {
    const first = entry({ ...ROWING, sets: [set(0, { targetWeight: null, targetReps: null })], history: [] })
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1/e2', session(first))
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
    await renderAt('/muscu/seance/s1/e2')
    expect(await screen.findByRole('textbox', { name: 'Charge série 3' })).toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    expect(screen.queryByRole('textbox', { name: 'Charge série 4' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Valider la série 4' })).toBeDisabled()
  })

  it('reopening an earlier set makes it the one to edit; later sets to do stay locked', async () => {
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1/e2')
    await user.click(await screen.findByRole('button', { name: 'Série 1 faite, modifier' }))
    expect(await screen.findByRole('textbox', { name: 'Charge série 1' })).toHaveValue('60')
    expect(screen.getByRole('button', { name: 'Série 2 faite, modifier' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Charge série 3' })).toBeNull()
    expect((await storedEntry('e2')).sets[0]).toMatchObject({ done: false, doneAt: null })
  })

  it('offline: Terminé needs every set done; Facile toggles', async () => {
    online = false
    const all = entry({ ...ROWING, sets: [0, 1, 2, 3].map((i) => set(i, { weight: 60, reps: 10, done: true })) })
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1/e2', session(all))

    const easy = 'Facile, monter la charge la prochaine fois'
    await user.click(await screen.findByRole('button', { name: easy, pressed: false }))
    expect(await screen.findByRole('button', { name: easy, pressed: true })).toHaveTextContent('Facile')
    expect((await storedEntry('e2')).easy).toBe(true)
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull()

    // Tapping it again clears it.
    await user.click(screen.getByRole('button', { name: easy, pressed: true }))
    expect(await screen.findByRole('button', { name: easy, pressed: false })).toBeInTheDocument()

    // Everything done: no early stop, Terminé completes.
    expect(screen.queryByRole('button', { name: 'Terminer l’exercice plus tôt' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Terminé' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu'))
    expect(await storedEntry('e2')).toMatchObject({ easy: false, completed: true })
    expectNoApiCall()
  })

  it('stops early after a confirmation; Terminé stays disabled until all sets are done', async () => {
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1/e2')
    expect(await screen.findByRole('button', { name: 'Terminé' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Terminer l’exercice plus tôt' }))
    const confirm = screen.getByRole('dialog', { name: 'Terminer avec 2 / 4 séries ?' })
    await user.click(within(confirm).getByRole('button', { name: 'Terminer' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu'))
    expect((await storedEntry('e2')).completed).toBe(true)
  })

  it('no early stop before the first set', async () => {
    await renderAt('/muscu/seance/s1/e2', session(entry({ ...ROWING, sets: [0, 1, 2, 3].map((i) => set(i)) })))
    expect(await screen.findByRole('button', { name: 'Terminé' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Terminer l’exercice plus tôt' })).toBeNull()
  })

  it('offline, the whole flow: sets, Terminé, then the list shows ✓', async () => {
    online = false
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1')
    await user.click(await screen.findByRole('link', { name: /Rowing barre/ }))
    await user.click(await screen.findByRole('button', { name: 'Valider la série 3' }))
    await user.click(await screen.findByRole('button', { name: 'Valider la série 4' }))
    await user.click(await screen.findByRole('button', { name: 'Terminé' }))
    expect(await screen.findByText('2 / 3 faits')).toBeInTheDocument()
    const rowing = within(screen.getByRole('list')).getAllByRole('link')[1]
    expect(within(rowing).getByRole('img', { name: 'Fait' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Terminer la séance, connexion requise' })).toBeDisabled()
    expectNoApiCall()
  })
})

describe('Exercice en cours — assistance (bodyweight exercises)', () => {
  const TRACTIONS = { ...ex('x9', 'Tractions'), equipment: 'bodyweight' as const }
  const at = (weight: number, reps: number[]) => reps.map((r) => ({ weight, reps: r }))
  // Aide 20 × 9·9·8·8 last time → targets Aide 20 × 10·10·9·9, stored −20.
  const ASSISTED = entry({
    ...ROWING,
    exercise: TRACTIONS,
    sets: [10, 10, 9, 9].map((targetReps, i) => set(i, { targetWeight: -20, targetReps })),
    lastTime: { date: '2026-10-08', sets: at(-20, [9, 9, 8, 8]) },
  })
  const withDone = (e: LocalEntry, done: Record<number, Partial<SessionSetDto>>): LocalEntry => ({
    ...e,
    sets: e.sets.map((s) => (done[s.index] ? { ...s, ...done[s.index], done: true, doneAt: doneAt(s.index) } : s)),
  })
  const toggle = () => screen.getByRole('group', { name: 'Type de charge' })
  const pressed = (name: string) => within(toggle()).getByRole('button', { name }).getAttribute('aria-pressed')
  const weights = async () => (await storedEntry('e2')).sets.map((s) => s.weight)

  it('shows the Lest | Aide control only for bodyweight exercises', async () => {
    const view = await renderAt('/muscu/seance/s1/e2')
    await screen.findByRole('heading', { name: 'Rowing barre' })
    expect(screen.queryByRole('group', { name: 'Type de charge' })).toBeNull()
    expect(screen.getByText('kg')).toBeInTheDocument()
    view.unmount()

    await renderAt('/muscu/seance/s1/e2', session(ASSISTED))
    await screen.findByRole('heading', { name: 'Tractions' })
    expect(within(toggle()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Lest', 'Aide'])
  })

  it('negative targets open in Aide: every number is shown positive, under "Aide kg"', async () => {
    await renderAt('/muscu/seance/s1/e2', session(withDone(ASSISTED, { 0: { weight: -20, reps: 10 } })))
    await screen.findByRole('heading', { name: 'Tractions' })
    expect(pressed('Aide')).toBe('true')
    expect(pressed('Lest')).toBe('false')
    expect(screen.getByText('Aide kg')).toBeInTheDocument()
    expect(screen.queryByText('kg')).toBeNull()
    expect(screen.getAllByText('20 × 10')).toHaveLength(2)
    expect(screen.getAllByText('20 × 9')).toHaveLength(2)
    expect(screen.getByRole('textbox', { name: 'Aide série 2' })).toHaveAttribute('placeholder', '20')
    expect(screen.queryByRole('textbox', { name: 'Charge série 2' })).toBeNull()
    expect(document.body).not.toHaveTextContent(/-20|−20/)
    expect(screen.getByText('Aide 20 kg × 9 · 9 · 8 · 8')).toBeInTheDocument()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('Aide stores negatives: a typed 15 is kept as −15, ✓ on an empty row records the target', async () => {
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1/e2', session(ASSISTED))
    await user.type(await screen.findByRole('textbox', { name: 'Aide série 1' }), '15')
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }))
    expect(await screen.findByRole('button', { name: 'Série 1 faite, modifier' })).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect((await storedEntry('e2')).sets[0]).toMatchObject({ weight: -15, reps: 10, done: true })

    await user.click(screen.getByRole('button', { name: 'Valider la série 2' }))
    await waitFor(async () => expect((await storedEntry('e2')).sets[1]).toMatchObject({ weight: -20, reps: 10, done: true }))
  })

  it('selecting Aide mid-session flips the sets already logged: 10 → −10, and back', async () => {
    const first = entry({ ...ASSISTED, sets: [0, 1, 2, 3].map((i) => set(i, { targetWeight: null, targetReps: null })), history: [] })
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1/e2', session(withDone(first, { 0: { weight: 10, reps: 8 }, 1: { weight: 10, reps: 7 } })))
    await screen.findByRole('heading', { name: 'Tractions' })
    expect(pressed('Lest')).toBe('true')

    await user.click(within(toggle()).getByRole('button', { name: 'Aide' }))
    await waitFor(async () => expect(await weights()).toEqual([-10, -10, null, null]))
    expect(pressed('Aide')).toBe('true')
    expect(screen.getByText('Aide kg')).toBeInTheDocument()
    // Each set keeps its time.
    expect((await storedEntry('e2')).sets[0].doneAt).toBe(doneAt(0))

    await user.click(within(toggle()).getByRole('button', { name: 'Lest' }))
    await waitFor(async () => expect(await weights()).toEqual([10, 10, null, null]))
    await user.type(await screen.findByRole('textbox', { name: 'Charge série 3' }), '10')
    await user.type(screen.getByRole('textbox', { name: 'Répétitions série 3' }), '6')
    await user.click(screen.getByRole('button', { name: 'Valider la série 3' }))
    await waitFor(async () => expect(await weights()).toEqual([10, 10, 10, null]))
  })

  it('switching before any set is logged changes nothing stored; targets of the other mode are not targets', async () => {
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1/e2', session(ASSISTED))
    await screen.findByRole('heading', { name: 'Tractions' })
    await user.click(within(toggle()).getByRole('button', { name: 'Lest' }))
    expect(pressed('Lest')).toBe('true')
    expect(await storedEntry('e2')).toEqual(ASSISTED)
    expect(screen.queryByText('20 × 10')).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Charge série 1' })).not.toHaveAttribute('placeholder')
    expect(screen.getByRole('button', { name: 'Valider la série 1' })).toBeDisabled()
  })

  it('opens in Lest at 0 kg once the help has reached 0', async () => {
    const zero = entry({
      ...ASSISTED,
      sets: [0, 1, 2, 3].map((i) => set(i, { targetWeight: 0, targetReps: 8 })),
      lastTime: { date: '2026-10-08', sets: at(-4.5, [12, 12, 11, 10]) },
    })
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1/e2', session(zero))
    await screen.findByRole('heading', { name: 'Tractions' })
    expect(pressed('Lest')).toBe('true')
    expect(screen.getByText('kg')).toBeInTheDocument()
    expect(screen.getAllByText('0 × 8')).toHaveLength(4)
    expect(screen.getByRole('textbox', { name: 'Charge série 1' })).toHaveAttribute('placeholder', '0')
    expect(screen.getByText('Aide 4,5 kg × 12 · 12 · 11 · 10')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Charge série 1' }), '2,5')
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }))
    await waitFor(async () => expect((await storedEntry('e2')).sets[0]).toMatchObject({ weight: 2.5, reps: 8 }))
  })
})

describe('Superset en cours', () => {
  const done = { weight: 10, reps: 14, done: true }
  // A: 4 sets (A1 done), B: 3 sets (none done) → A1 B1 A2 B2 A3 B3 A4, B1 is next.
  const A = entry({
    id: 'ea',
    exercise: ex('xa', 'Élévations latérales'),
    repMin: 12,
    repMax: 15,
    sets: [set(0, { targetWeight: 10, targetReps: 14, ...done }), ...[1, 2, 3].map((i) => set(i, { targetWeight: 10, targetReps: 13 }))],
    supersetGroup: 'g',
    lastTime: { date: '2026-09-28', sets: [13, 13, 12, 11].map((reps) => ({ weight: 10, reps })) },
  })
  const B = entry({
    id: 'eb',
    exercise: ex('xb', 'Extension triceps poulie'),
    repMin: 10,
    repMax: 12,
    sets: [0, 1, 2].map((i) => set(i, { targetWeight: 25, targetReps: 11 })),
    supersetGroup: 'g',
    lastTime: { date: '2026-09-21', sets: [11, 10, 10].map((reps) => ({ weight: 25, reps })) },
  })
  const pair = (a = A, b = B) => ({ ...session(a, b), workoutName: 'Push B' })
  const allDone = (e: LocalEntry) => ({ ...e, sets: e.sets.map((s) => ({ ...s, weight: 10, reps: 12, done: true, doneAt: doneAt(s.index) })) })

  it('shows both exercises (not links) and their sets alternately, the rest of the longer one last', async () => {
    await renderAt('/muscu/seance/s1/superset/ea', pair())
    expect(await screen.findByRole('heading', { name: 'Push B · Superset' })).toBeInTheDocument()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getByText('3 × 10–12')).toBeInTheDocument()

    const order = screen
      .getAllByRole('button', { name: /^(Valider [AB]\d|[AB]\d faite, modifier)$/ })
      .map((b) => b.getAttribute('aria-label')!.replace(/Valider | faite, modifier/g, ''))
    expect(order).toEqual(['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4'])

    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    expect(screen.getByRole('textbox', { name: 'Charge B1' })).toHaveAttribute('placeholder', '25')
    expect(screen.getByRole('textbox', { name: 'Répétitions B1' })).toHaveAttribute('placeholder', '11')
    expect(screen.getByRole('button', { name: 'Valider A2' })).toBeDisabled()

    expect(screen.getByText('Dernière fois · lun 28 sept')).toBeInTheDocument()
    expect(screen.getByText('10 kg × 13 · 13 · 12 · 11')).toBeInTheDocument()
    expect(screen.getByText('25 kg × 11 · 10 · 10')).toBeInTheDocument()
  })

  it('offline: ✓ saves the set of its own exercise in the local copy; any done set can be reopened', async () => {
    online = false
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1/superset/ea', pair())

    await user.click(await screen.findByRole('button', { name: 'Valider B1' }))
    expect(await screen.findByRole('textbox', { name: 'Charge A2' })).toHaveAttribute('placeholder', '10')
    expect((await storedEntry('eb')).sets[0]).toMatchObject({ weight: 25, reps: 11, done: true })

    await user.click(screen.getByRole('button', { name: 'A1 faite, modifier' }))
    await waitFor(async () => expect((await storedEntry('ea')).sets[0].done).toBe(false))
    expectNoApiCall()
  })

  it('has one Facile toggle per exercise, with its badge', async () => {
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1/superset/ea', pair())
    const toggle = await screen.findByRole('button', { name: 'Extension triceps poulie facile', pressed: false })
    expect(toggle).toHaveTextContent('BFacile')
    await user.click(toggle)
    expect(await screen.findByRole('button', { name: 'Extension triceps poulie facile', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Élévations latérales facile', pressed: false })).toHaveTextContent('AFacile')
    expect((await storedEntry('eb')).easy).toBe(true)
  })

  it('Terminé completes both exercises once every set is done', async () => {
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1/superset/ea', pair(allDone(A), allDone(B)))
    await user.click(await screen.findByRole('button', { name: 'Terminé' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu'))
    expect((await storedEntry('ea')).completed).toBe(true)
    expect((await storedEntry('eb')).completed).toBe(true)
  })

  it('stops early after a confirmation: only the exercise with a validated set is completed', async () => {
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1/superset/ea', pair())
    expect(await screen.findByRole('button', { name: 'Terminé' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Terminer le superset plus tôt' }))
    const confirm = screen.getByRole('dialog', { name: 'Terminer avec 1 / 7 séries ?' })
    await user.click(within(confirm).getByRole('button', { name: 'Terminer' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu'))
    expect((await storedEntry('ea')).completed).toBe(true)
    expect((await storedEntry('eb')).completed).toBe(false)
  })

  it('a bodyweight exercise of the pair has its own Lest | Aide control; its help is stored negative', async () => {
    const pullUps = entry({
      ...A,
      exercise: { ...ex('xa', 'Tractions'), equipment: 'bodyweight' },
      sets: [0, 1, 2, 3].map((i) => set(i, { targetWeight: -20, targetReps: 9 })),
      lastTime: { date: '2026-09-28', sets: [9, 9, 8, 8].map((reps) => ({ weight: -20, reps })) },
    })
    const user = userEvent.setup()
    await renderAt('/muscu/seance/s1/superset/ea', pair(pullUps, B))

    const group = await screen.findByRole('group', { name: 'Type de charge Tractions' })
    expect(within(group).getByRole('button', { name: 'Aide' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('group', { name: 'Type de charge Extension triceps poulie' })).toBeNull()
    expect(screen.getByText('kg')).toBeInTheDocument()
    expect(screen.getByText('Aide 20 kg × 9 · 9 · 8 · 8')).toBeInTheDocument()

    const help = screen.getByRole('textbox', { name: 'Aide A1' })
    expect(help).toHaveAttribute('placeholder', '20')
    await user.type(help, '15')
    await user.click(screen.getByRole('button', { name: 'Valider A1' }))
    expect(await screen.findByRole('textbox', { name: 'Charge B1' })).toHaveAttribute('placeholder', '25')
    expect((await storedEntry('ea')).sets[0]).toMatchObject({ weight: -15, reps: 9 })

    await user.click(within(screen.getByRole('group', { name: 'Type de charge Tractions' })).getByRole('button', { name: 'Lest' }))
    await waitFor(async () => expect((await storedEntry('ea')).sets[0].weight).toBe(15))
  })

  it('opens the usual screen for an exercise that is not in a superset', async () => {
    await renderAt('/muscu/seance/s1/superset/e2')
    expect(await screen.findByRole('heading', { name: 'Rowing barre' })).toBeInTheDocument()
  })
})
