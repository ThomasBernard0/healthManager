import { exercisesImage } from '../../../api/generated/endpoints/exercises/exercises'
import type { SessionBundleDto } from '../../../api/generated/model'
import {
  clearLocalSession,
  readLocalSession,
  readStoredImages,
  resetLocalSessionCache,
  storeBundle,
  updateLocalSession,
} from './store'

vi.mock('../../../api/generated/endpoints/exercises/exercises', () => ({ exercisesImage: vi.fn() }))

const BUNDLE: SessionBundleDto = {
  id: 's1',
  workoutId: 'w1',
  workoutName: 'Pull',
  startedAt: '2026-10-14T17:00:00.000Z',
  exercises: [
    {
      id: 'e1',
      exercise: {
        id: 'x1',
        name: 'Rowing barre',
        equipment: 'barbell',
        primaryMuscles: ['back'],
        secondaryMuscles: [],
        sets: 1,
        repMin: 8,
        repMax: 12,
        imageVersion: '7',
        workouts: [],
      },
      repMin: 8,
      repMax: 12,
      supersetGroup: null,
      easy: false,
      completed: false,
      sets: [{ index: 0, targetWeight: null, targetReps: null, weight: null, reps: null, done: false, doneAt: null }],
      history: [],
      knownWeights: [],
      step: 5,
    },
  ],
}

describe('local copy of the session (IndexedDB)', () => {
  beforeEach(() => clearLocalSession())

  it('keeps the bundle and the pictures; a change is still there after a reload', async () => {
    vi.mocked(exercisesImage).mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
    await storeBundle(BUNDLE)
    expect(exercisesImage).toHaveBeenCalledWith('x1', { v: '7' })
    expect(Object.keys(await readStoredImages())).toEqual(['x1'])

    await updateLocalSession((s) => ({ ...s, exercises: s.exercises.map((e) => ({ ...e, easy: true })) }))
    // A reload: nothing in memory, read from the device again.
    resetLocalSessionCache()
    const reloaded = await readLocalSession()
    expect(reloaded).toMatchObject({ id: 's1', workoutName: 'Pull' })
    expect(reloaded!.exercises[0].easy).toBe(true)
  })

  it('a picture that fails to load does not stop Démarrer', async () => {
    vi.mocked(exercisesImage).mockRejectedValue(new Error('network'))
    await storeBundle(BUNDLE)
    expect(await readStoredImages()).toEqual({})
    expect((await readLocalSession())!.id).toBe('s1')
  })

  it('is deleted after Terminer or Quitter', async () => {
    vi.mocked(exercisesImage).mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
    await storeBundle(BUNDLE)
    await clearLocalSession()
    resetLocalSessionCache()
    expect(await readLocalSession()).toBeNull()
    expect(await readStoredImages()).toEqual({})
  })
})
