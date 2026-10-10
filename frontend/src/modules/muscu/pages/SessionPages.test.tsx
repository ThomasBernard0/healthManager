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
  imageUrl: null,
  workouts: [],
})

const SESSION: SessionDto = {
  id: 's1',
  workoutId: 'w1',
  workoutName: 'Pull',
  startedAt: '2026-10-10T08:00:00.000Z',
  finishedAt: null,
  exercises: [
    { id: 'e1', exercise: ex('x1', 'Tirage vertical prise large'), status: 'done', preFatigue: 0 },
    { id: 'e2', exercise: ex('x2', 'Rowing barre'), status: 'inProgress', preFatigue: 4 },
    { id: 'e3', exercise: ex('x3', 'Curl haltères'), status: 'todo', preFatigue: 0 },
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
  feeling: null,
  completed: false,
  sets: [set(0, { weight: 60, reps: 12, done: true }), set(1, { weight: 60, reps: 9, done: true }), set(2), set(3)],
  preFatigue: 0,
  fatiguedMuscles: [],
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
    const links = screen.getAllByRole('link')
    expect(within(links[0]).getByRole('img', { name: 'Fait' })).toBeInTheDocument()
    expect(within(links[1]).getByText('En cours')).toBeInTheDocument()
    expect(links[2]).toHaveAttribute('href', '/muscu/seance/s1/e3')
    // Pre-fatigue: battery icon on that exercise only.
    expect(within(links[1]).getByRole('img', { name: 'Muscles déjà travaillés' })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Muscles déjà travaillés' })).toHaveLength(1)
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

  it('shows "{muscle} déjà travaillé" when pre-fatigued, linking to the exercise page', async () => {
    vi.mocked(sessionsGetExercise).mockResolvedValue({ ...ENTRY, preFatigue: 4, fatiguedMuscles: ['back'] })
    renderAt('/muscu/seance/s1/e2')
    const tag = await screen.findByText('Dos déjà travaillé')
    expect(tag.closest('a')).toHaveAttribute('href', '/muscu/exercices/x2')
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

  it('tapping ✓ again reopens a set; Ressenti toggles; Terminé completes and goes back', async () => {
    vi.mocked(sessionsGetExercise).mockResolvedValue(ENTRY)
    vi.mocked(sessionsSaveSet).mockResolvedValue(ENTRY)
    vi.mocked(sessionsUpdateExercise).mockResolvedValue({ ...ENTRY, feeling: 'easy' })
    const user = userEvent.setup()
    renderAt('/muscu/seance/s1/e2')
    await user.click(await screen.findByRole('button', { name: 'Série 2 faite, modifier' }))
    expect(sessionsSaveSet).toHaveBeenCalledWith('s1', 'e2', 1, { weight: 60, reps: 9, done: false })

    await user.click(screen.getByRole('button', { name: 'Facile' }))
    expect(sessionsUpdateExercise).toHaveBeenCalledWith('s1', 'e2', { feeling: 'easy' })
    expect(await screen.findByRole('button', { name: 'Facile', pressed: true })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Terminé' }))
    expect(sessionsUpdateExercise).toHaveBeenLastCalledWith('s1', 'e2', { completed: true })
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu'))
  })
})
