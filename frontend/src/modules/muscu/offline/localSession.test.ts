import { DIPS_THEN_BENCH, type FixtureExercise } from '@healthmanager/shared/testing'
import type { SessionBundleDto, SessionBundleExerciseDto } from '../../../api/generated/model'
import { entryStatus, exerciseView, finishBody, fromBundle, saveSet, updateExercise, type LocalSession } from './localSession'

const bundleExercise = (id: string, e: FixtureExercise, supersetGroup: string | null = null): SessionBundleExerciseDto => ({
  id,
  exercise: {
    id: `x-${id}`,
    name: e.name,
    equipment: e.equipment,
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
    sets: e.sets,
    repMin: e.repMin,
    repMax: e.repMax,
    imageVersion: null,
    workouts: [],
  },
  repMin: e.repMin,
  repMax: e.repMax,
  supersetGroup,
  easy: false,
  completed: false,
  sets: Array.from({ length: e.sets }, (_, index) => ({
    index,
    targetWeight: null,
    targetReps: null,
    weight: null,
    reps: null,
    done: false,
    doneAt: null,
  })),
  history: e.history,
  knownWeights: e.known,
  step: e.equipment === 'barbell' ? 5 : 2.5,
})

// The same history as the backend tests (shared fixture): the phone must find the server's targets.
const BUNDLE: SessionBundleDto = {
  id: 's1',
  workoutId: 'w1',
  workoutName: 'Push',
  startedAt: '2026-10-14T17:00:00.000Z',
  exercises: [bundleExercise('dips', DIPS_THEN_BENCH.dips), bundleExercise('bench', DIPS_THEN_BENCH.bench)],
}

const at = (minute: number) => new Date(Date.UTC(2026, 9, 14, 17, minute))
const targets = (session: LocalSession, id: string) =>
  exerciseView(session, id)!.sets.map((s) => ({ weight: s.targetWeight, reps: s.targetReps }))

/** 3 sets of Dips at bodyweight. */
function afterDips(): LocalSession {
  let s = fromBundle(BUNDLE)
  for (const i of [0, 1, 2]) s = saveSet(s, 'dips', i, { weight: 0, reps: 10, done: true }, at(i))
  return s
}

describe('targets on the phone (same as the server for the same history)', () => {
  it('Développé couché done first, then after 3 sets of Dips: the same targets (pre-fatigue never blocks the +1)', () => {
    expect(targets(fromBundle(BUNDLE), 'bench')).toEqual(DIPS_THEN_BENCH.benchTargets)
    expect(targets(afterDips(), 'bench')).toEqual(DIPS_THEN_BENCH.benchTargets)
  })

  it('first time (no history): no target', () => {
    expect(targets(fromBundle(BUNDLE), 'dips').every((t) => t.weight === null && t.reps === null)).toBe(true)
  })

  it('frozen once its first set is validated: later sets elsewhere change nothing', () => {
    let s = saveSet(fromBundle(BUNDLE), 'bench', 0, { weight: null, reps: null, done: true }, at(0))
    expect(s.exercises[1].preFatigue).toBe(0)
    for (const i of [0, 1, 2]) s = saveSet(s, 'dips', i, { weight: 0, reps: 10, done: true }, at(5 + i))
    expect(targets(s, 'bench')).toEqual(DIPS_THEN_BENCH.benchTargets)
    // ✓ on an empty row recorded the target.
    expect(s.exercises[1].sets[0]).toMatchObject({ weight: 60, reps: 10, done: true, doneAt: at(0).toISOString() })
  })

  it('a bundle with an exercise already started keeps its stored targets', () => {
    const started = { ...BUNDLE.exercises[1], sets: BUNDLE.exercises[1].sets.map((s) => ({ ...s, targetWeight: 50, targetReps: 8 })) }
    started.sets[0] = { ...started.sets[0], weight: 50, reps: 8, done: true, doneAt: at(0).toISOString() }
    const s = fromBundle({ ...BUNDLE, exercises: [BUNDLE.exercises[0], started] })
    expect(targets(s, 'bench')[1]).toEqual({ weight: 50, reps: 8 })
  })
})

describe('sets, Facile, Terminé on the local copy', () => {
  it('validates the sets in order; any done set can be reopened', () => {
    const s = afterDips()
    expect(() => saveSet(fromBundle(BUNDLE), 'dips', 1, { weight: 0, reps: 10, done: true }, at(0))).toThrow()
    const reopened = saveSet(s, 'dips', 0, { weight: 0, reps: 10, done: false }, at(9))
    expect(reopened.exercises[0].sets[0]).toMatchObject({ done: false, doneAt: null })
    expect(entryStatus(reopened.exercises[0])).toBe('inProgress')
  })

  it('saving a done set again (Lest ↔ Aide) keeps its time', () => {
    const s = saveSet(afterDips(), 'dips', 1, { weight: -10, reps: 10, done: true }, at(30))
    expect(s.exercises[0].sets[1]).toMatchObject({ weight: -10, doneAt: at(1).toISOString() })
  })

  it('Terminé needs a validated set; reopening every set clears it', () => {
    expect(updateExercise(fromBundle(BUNDLE), 'dips', { completed: true }).exercises[0].completed).toBe(false)
    let s = updateExercise(afterDips(), 'dips', { completed: true, easy: true })
    expect(s.exercises[0]).toMatchObject({ completed: true, easy: true })
    expect(entryStatus(s.exercises[0])).toBe('done')
    for (const i of [0, 1, 2]) s = saveSet(s, 'dips', i, { weight: null, reps: null, done: false }, at(9))
    expect(s.exercises[0].completed).toBe(false)
  })

  it('finish body: every exercise with its sets, Facile and Terminé; values only on validated sets', () => {
    const s = saveSet(afterDips(), 'dips', 2, { weight: 5, reps: 7, done: false }, at(9))
    const body = finishBody(updateExercise(s, 'dips', { easy: true }))
    expect(body.exercises.map((e) => e.id)).toEqual(['dips', 'bench'])
    expect(body.exercises[0]).toMatchObject({ easy: true, completed: false })
    expect(body.exercises[0].sets).toEqual([
      { index: 0, targetWeight: null, targetReps: null, weight: 0, reps: 10, done: true, doneAt: at(0).toISOString() },
      { index: 1, targetWeight: null, targetReps: null, weight: 0, reps: 10, done: true, doneAt: at(1).toISOString() },
      { index: 2, targetWeight: null, targetReps: null, weight: null, reps: null, done: false, doneAt: null },
    ])
  })
})

describe('superset', () => {
  it('finds the partner; in a superset, the usual targets (no special case)', () => {
    const paired: SessionBundleDto = {
      ...BUNDLE,
      exercises: [bundleExercise('dips', DIPS_THEN_BENCH.dips, 'g'), bundleExercise('bench', DIPS_THEN_BENCH.bench, 'g')],
    }
    const view = exerciseView(fromBundle(paired), 'bench')!
    expect(view.partnerId).toBe('dips')
    expect(view.sets.map((s) => s.targetReps)).toEqual([10, 10, 9, 9])
  })
})
