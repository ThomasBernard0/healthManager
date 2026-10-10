import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import {
  exercisesCreate,
  exercisesGet,
  exercisesList,
  exercisesUpdate,
  exercisesHistory,
} from '../../../api/generated/endpoints/exercises/exercises'
import { addDays, parisToday } from '@healthmanager/shared'
import type { ExerciseDto } from '../../../api/generated/model'
import ExerciseEditPage from './ExerciseEditPage'
import ExercisePage from './ExercisePage'
import ExercisesPage from './ExercisesPage'

vi.mock('../../../api/generated/endpoints/exercises/exercises', () => ({
  exercisesList: vi.fn(),
  exercisesGet: vi.fn(),
  exercisesCreate: vi.fn(),
  exercisesUpdate: vi.fn(),
  exercisesHistory: vi.fn(),
}))

const ROWING: ExerciseDto = {
  id: 'r1',
  name: 'Rowing barre',
  equipment: 'barbell',
  primaryMuscles: ['back'],
  secondaryMuscles: ['biceps', 'shoulders_rear'],
  imageUrl: '/exercises/rowing-barre.svg',
  workouts: [],
}
const ECARTE: ExerciseDto = {
  id: 'e1',
  name: 'Écarté poulie vis-à-vis',
  equipment: 'cable',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['shoulders_front'],
  imageUrl: null,
  workouts: [],
}

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/muscu/exercices" element={<ExercisesPage />} />
        <Route path="/muscu/exercices/nouveau" element={<ExerciseEditPage />} />
        <Route path="/muscu/exercices/:id" element={<><ExercisePage /><Where /></>} />
        <Route path="/muscu/exercices/:id/modifier" element={<ExerciseEditPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Exercices', () => {
  beforeEach(() => vi.resetAllMocks())

  it('lists the bank with muscles and equipment, searchable without accents', async () => {
    vi.mocked(exercisesList).mockResolvedValue([ECARTE, ROWING])
    const user = userEvent.setup()
    renderAt('/muscu/exercices')
    expect(await screen.findByText('Dos, biceps, épaules · Barre')).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Chercher un exercice' }), 'ECARTE')
    expect(screen.queryByText('Rowing barre')).toBeNull()
    expect(screen.getByRole('link', { name: /Écarté poulie vis-à-vis/ })).toHaveAttribute('href', '/muscu/exercices/e1')
  })
})

describe('Fiche exercice', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(exercisesHistory).mockResolvedValue([])
  })

  it('shows Progression (last 12 weeks) and Historique; tapping a bar shows date, sets and volume', async () => {
    const today = parisToday()
    vi.mocked(exercisesGet).mockResolvedValue(ROWING)
    vi.mocked(exercisesHistory).mockResolvedValue([
      { sessionId: 's3', date: addDays(today, -7), sets: [10, 9, 9, 8].map((reps) => ({ weight: 60, reps })), feeling: 'ok', preFatigue: 0, volume: 2160, heaviest: 60 },
      { sessionId: 's2', date: addDays(today, -14), sets: [12, 12, 11, 10].map((reps) => ({ weight: 57.5, reps })), feeling: 'easy', preFatigue: 3, volume: 2587.5, heaviest: 57.5 },
      // Older than 12 weeks: in the history, not in the chart.
      { sessionId: 's1', date: addDays(today, -100), sets: [{ weight: 50, reps: 10 }], feeling: null, preFatigue: 0, volume: 500, heaviest: 50 },
    ])
    const user = userEvent.setup()
    renderAt('/muscu/exercices/r1')
    const chart = await screen.findByRole('group', { name: 'Charge et volume par séance' })
    const bars = within(chart).getAllByRole('button')
    expect(bars).toHaveLength(2)

    await user.click(bars[0])
    const callout = within(chart).getByRole('status')
    expect(callout).toHaveTextContent('57,5 kg × 12 · 12 · 11 · 10')
    expect(callout).toHaveTextContent('2 588 kg')
    await user.click(screen.getByRole('heading', { name: 'Rowing barre' }))
    expect(within(chart).queryByRole('status')).toBeNull()

    const history = screen.getByRole('heading', { name: 'Historique' }).closest('section')!
    expect(within(history).getAllByRole('listitem')).toHaveLength(3)
    expect(within(history).getByText('60 kg × 10 · 9 · 9 · 8')).toBeInTheDocument()
    expect(within(history).getAllByRole('img', { name: 'Muscles déjà travaillés' })).toHaveLength(1)
    expect(within(history).getByText('Facile')).toBeInTheDocument()
  })

  it('shows the name, equipment and muscles as pills', async () => {
    vi.mocked(exercisesGet).mockResolvedValue(ROWING)
    renderAt('/muscu/exercices/r1')
    expect(await screen.findByRole('heading', { name: 'Rowing barre' })).toBeInTheDocument()
    expect(screen.getByText('Barre')).toBeInTheDocument()
    expect(screen.getByText('Dos')).toBeInTheDocument()
    expect(screen.getByText('Arrière d’épaule')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Modifier l’exercice' })).toHaveAttribute('href', '/muscu/exercices/r1/modifier')
  })
})

describe('Créer / Modifier l’exercice', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(exercisesHistory).mockResolvedValue([])
  })

  it('cycles a muscle none → secondary → primary → none and creates the exercise', async () => {
    vi.mocked(exercisesCreate).mockResolvedValue({ ...ECARTE, id: 'new1' })
    vi.mocked(exercisesGet).mockResolvedValue({ ...ECARTE, id: 'new1' })
    const user = userEvent.setup()
    renderAt('/muscu/exercices/nouveau')
    const save = await screen.findByRole('button', { name: 'Enregistrer' })
    expect(save).toBeDisabled()

    await user.type(screen.getByRole('textbox', { name: 'Nom' }), 'Pull-over')
    await user.click(screen.getByRole('button', { name: 'Haltères' }))
    await user.click(screen.getByRole('button', { name: 'Dos : non travaillé' }))
    expect(save).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Dos : secondaire' }))
    await user.click(screen.getByRole('button', { name: 'Pectoraux : non travaillé' }))
    await user.click(screen.getByRole('button', { name: 'Triceps : non travaillé' }))
    await user.click(screen.getByRole('button', { name: 'Triceps : secondaire' }))
    await user.click(screen.getByRole('button', { name: 'Triceps : principal' }))
    expect(screen.getByRole('button', { name: 'Triceps : non travaillé' })).toBeInTheDocument()
    await user.click(save)

    expect(exercisesCreate).toHaveBeenCalledWith({
      name: 'Pull-over',
      equipment: 'dumbbell',
      primaryMuscles: ['back'],
      secondaryMuscles: ['chest'],
    })
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/muscu/exercices/new1'))
  })

  it('edits an existing exercise', async () => {
    vi.mocked(exercisesGet).mockResolvedValue(ROWING)
    vi.mocked(exercisesUpdate).mockResolvedValue(ROWING)
    const user = userEvent.setup()
    renderAt('/muscu/exercices/r1/modifier')
    const name = await screen.findByRole('textbox', { name: 'Nom' })
    expect(name).toHaveValue('Rowing barre')
    expect(screen.getByRole('button', { name: 'Barre' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Dos : principal' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Biceps : secondaire' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(exercisesUpdate).toHaveBeenCalledWith('r1', {
      name: 'Rowing barre',
      equipment: 'barbell',
      primaryMuscles: ['back', 'biceps'],
      secondaryMuscles: ['shoulders_rear'],
    })
  })
})
